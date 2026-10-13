// HealthGo 5.2 — secure, optional bridge to a SELF-HOSTED Open Wearables instance.
// Default-deny until OW_BASE_URL and OW_API_KEY are set in Supabase secrets.
// No browser API keys, OAuth tokens, demo connections, XP awards or automatic health uploads.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const SB_URL=Deno.env.get("SUPABASE_URL")||"";
const SB_ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const SB_SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OW_BASE=(Deno.env.get("OW_BASE_URL")||"").replace(/\/+$/,"");
const OW_KEY=Deno.env.get("OW_API_KEY")||"";
const PROVIDERS=new Set(["garmin","polar","suunto","whoop","oura","strava","ultrahuman","google_health"]);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS","Cache-Control":"no-store"};
const reply=(code:number,data:Record<string,unknown>)=>
 new Response(JSON.stringify(data),{status:code,headers:{...cors,"Content-Type":"application/json"}});
function upstreamConfigured(){
 if(!SB_SERVICE||!SB_URL||!SB_ANON||!OW_KEY)return false;
 try{
  const u=new URL(OW_BASE);
  // Supabase Edge cannot connect to a localhost-only Docker server. Production
  // requires a privately controlled TLS endpoint with credentials in secrets.
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash&&
    !!u.hostname&&!["localhost","127.0.0.1","0.0.0.0"].includes(u.hostname)&&
    !u.hostname.endsWith(".local");
 }catch(_){return false;}
}
function safeExternalUrl(v:unknown){
 if(typeof v!=="string")return null;
 try{
  const u=new URL(v);
  return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname?u.toString():null;
 }catch(_){return null;}
}
async function upstream(path:string,method="GET",body?:unknown){
 const response=await fetch(OW_BASE+path,{
  method,headers:{"X-Open-Wearables-API-Key":OW_KEY,"Accept":"application/json",
    ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),redirect:"error",signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("upstream_http_"+response.status);
 if(response.status===204)return null;
 return response.json();
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("",{headers:cors});
 if(req.method!=="GET"&&req.method!=="POST")return reply(405,{error:"method_not_allowed"});
 const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token||!SB_URL||!SB_ANON||!SB_SERVICE)return reply(401,{error:"unauthorized"});
 const auth=createClient(SB_URL,SB_ANON,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await auth.auth.getUser(token).catch(()=>({data:{user:null},error:true}));
 const uid=data?.user?.id;
 if(error||!uid||!uuid.test(uid))return reply(401,{error:"unauthorized"});
 const admin=createClient(SB_URL,SB_SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
 if(!upstreamConfigured())return reply(200,{
  configured:false,connections:[],supportedProviders:[...PROVIDERS],
  message:"Open Wearables wymaga własnego serwera HTTPS i kont deweloperskich producentów."
 });
 const {data:link,error:dbError}=await admin.from("hg_open_wearables_links")
  .select("ow_user_id").eq("user_id",uid).maybeSingle();
 if(dbError)return reply(503,{error:"database_unavailable"});
 const ownId=link?.ow_user_id;
 // Read-only: no creation of a new account merely by opening the device page.
 if(req.method==="GET"){
  if(!ownId)return reply(200,{configured:true,connections:[],supportedProviders:[...PROVIDERS]});
  try{
   const list=await upstream("/api/v1/users/"+encodeURIComponent(ownId)+"/connections");
   if(!Array.isArray(list))return reply(502,{error:"invalid_provider_response"});
   const connections=list.slice(0,30).map((c)=>{
    const provider=typeof c?.provider==="string"?c.provider.slice(0,50):"unknown";
    const state=typeof c?.status==="string"?c.status:"unknown";
    return {provider,status:state,last_synced_at:typeof c?.last_synced_at==="string"?c.last_synced_at:null};
   });
   return reply(200,{configured:true,connections,supportedProviders:[...PROVIDERS]});
  }catch(_){return reply(502,{error:"open_wearables_unavailable"});}
 }
 let payload:Record<string,unknown>;
 try{
  payload=await req.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error();
 }catch(_){return reply(400,{error:"invalid_request"});}
 const provider=typeof payload.provider==="string"?payload.provider:"";
 if(!PROVIDERS.has(provider))return reply(400,{error:"unsupported_provider"});
 if(payload.action==="disconnect"){
  if(!ownId)return reply(404,{error:"not_connected"});
  try{
   // Official OW endpoint revokes provider connection and clears stored tokens.
   await upstream("/api/v1/users/"+encodeURIComponent(ownId)+"/connections/"+encodeURIComponent(provider),"DELETE");
   return reply(200,{disconnected:true});
  }catch(_){return reply(502,{error:"disconnect_not_confirmed"});}
 }
 if(payload.action!=="connect")return reply(400,{error:"unknown_action"});
 let id=ownId;
 if(!id){
  try{
   // OW user UUID maps to authenticated Supabase auth UUID, not a public email.
   const created=await upstream("/api/v1/users","POST",{external_user_id:uid});
   if(!uuid.test(created?.id||""))return reply(502,{error:"invalid_ow_user"});
   id=created.id;
   const written=await admin.from("hg_open_wearables_links").insert({user_id:uid,ow_user_id:id});
   if(written.error){
    const existing=await admin.from("hg_open_wearables_links").select("ow_user_id")
      .eq("user_id",uid).maybeSingle();
    if(existing.error||!existing.data?.ow_user_id)return reply(503,{error:"mapping_unavailable"});
    id=existing.data.ow_user_id;
   }
  }catch(_){return reply(502,{error:"open_wearables_create_failed"});}
 }
 try{
  const result=await upstream("/api/v1/oauth/"+provider+"/authorize?user_id="+encodeURIComponent(id));
  const url=safeExternalUrl(result?.authorization_url);
  if(!url)return reply(502,{error:"provider_authorization_unavailable"});
  // This is only the official provider consent URL, never "connected" status.
  return reply(200,{authorization_url:url});
 }catch(_){return reply(502,{error:"provider_authorization_unavailable"});}
});
