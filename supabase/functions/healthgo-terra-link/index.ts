// HealthGo Terra connection broker. Secret API keys never reach frontend clients.
// When Terra credentials are missing the endpoint remains safely disabled.
// Requires Supabase Auth JWT (verify_jwt=true) and per-request getUser verification.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const terraKey = Deno.env.get("TERRA_API_KEY") || "";
const terraDev = Deno.env.get("TERRA_DEV_ID") || "";
const api = "https://access.tryterra.co/api/v2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
function result(status: number, body: Record<string, unknown>){
  return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function configured(){return Boolean(terraKey && terraDev && service && anon && url);}
function hostAllowed(value: unknown): value is string{
  if(typeof value!=="string")return false;
  try{
    const u=new URL(value);
    return u.protocol==="https:"&&(u.hostname==="tryterra.co"||u.hostname.endsWith(".tryterra.co"))&&!u.username&&!u.password;
  }catch(_){return false;}
}
function rpcHeaders(){
  return {"dev-id":terraDev,"x-api-key":terraKey,"Content-Type":"application/json","Accept":"application/json"};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("",{headers:cors});
  if(!["GET","POST"].includes(req.method))return result(405,{error:"method_not_allowed"});
  const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token||!url||!anon||!service)return result(401,{error:"unauthorized"});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await auth.auth.getUser(token).catch(()=>({data:{user:null}}));
  const uid=verified?.data?.user?.id;
  if(!uid)return result(401,{error:"unauthorized"});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  if(req.method==="GET"){
    const {data,error}=await admin.from("hg_terra_connections")
      .select("id,provider,status,last_sync_at,updated_at").eq("user_id",uid)
      .order("updated_at",{ascending:false}).limit(25);
    if(error)return result(503,{error:"database_unavailable"});
    return result(200,{configured:configured(),connections:data||[],costNote:"Terra is a paid service. No subscription or charge is created by HealthGo."});
  }
  if(!configured())return result(503,{error:"terra_not_configured",message:"Usługa Terra wymaga osobnego konta i konfiguracji administratora. HealthGo nie pobiera żadnych opłat."});
  let body: Record<string,unknown>;
  try{body=await req.json();if(!body||typeof body!=="object")throw Error();}catch(_){return result(400,{error:"invalid_body"});}
  if(body.action==="disconnect"){
    const id=typeof body.connection_id==="string"?body.connection_id:"";
    if(!/^[0-9a-f-]{36}$/i.test(id))return result(400,{error:"invalid_connection"});
    const {data:existing,error:e}=await admin.from("hg_terra_connections")
      .select("id,user_id,terra_user_id,status").eq("id",id).eq("user_id",uid).maybeSingle();
    if(e||!existing)return result(404,{error:"not_found"});
    if(existing.status!=="connected")return result(200,{status:"already_disconnected"});
    const remote=await fetch(api+"/auth/deauthenticateUser?user_id="+encodeURIComponent(existing.terra_user_id),{
      method:"DELETE",headers:rpcHeaders(),signal:AbortSignal.timeout(12000)
    }).catch(()=>null);
    if(!remote?.ok)return result(502,{error:"remote_disconnect_failed"});
    const clear=await admin.from("hg_terra_daily_metrics").delete().eq("connection_id",id).eq("user_id",uid);
    if(clear.error)return result(503,{error:"metrics_cleanup_failed"});
    const saved=await admin.from("hg_terra_connections").update({status:"revoked",updated_at:new Date().toISOString()})
      .eq("id",id).eq("user_id",uid);
    if(saved.error)return result(503,{error:"database_unavailable"});
    return result(200,{status:"disconnected"});
  }
  if(body.action!=="connect")return result(400,{error:"unknown_action"});
  const reference=crypto.randomUUID();
  const expires=new Date(Date.now()+15*60*1000).toISOString();
  const pending=await admin.from("hg_terra_link_requests").insert({id:reference,user_id:uid,expires_at:expires});
  if(pending.error)return result(503,{error:"database_unavailable"});
  const response=await fetch(api+"/auth/generateWidgetSession",{
    method:"POST",headers:rpcHeaders(),
    body:JSON.stringify({reference_id:reference,language:"en"}),
    signal:AbortSignal.timeout(12000)
  }).catch(()=>null);
  const data=response?.ok?await response.json().catch(()=>null):null;
  if(!response?.ok||!data||data.status!=="success"||!hostAllowed(data.url)){
    await admin.from("hg_terra_link_requests").delete().eq("id",reference).eq("user_id",uid);
    return result(502,{error:"terra_widget_unavailable"});
  }
  return result(200,{url:data.url,expires_in:Math.min(900,Number(data.expires_in)||900)});
});
