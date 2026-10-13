// Terra signed webhooks. No JWT: source authentication is Terra HMAC-SHA256
// over timestamp + '.' + exact raw body. Never expose signing secret or raw health data.
// Disable endpoint until TERRA_WEBHOOK_SECRET is configured.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const url=Deno.env.get("SUPABASE_URL")||"";
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const secret=Deno.env.get("TERRA_WEBHOOK_SECRET")||"";
const encoder=new TextEncoder();
function json(status:number,body:Record<string,unknown>){
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function hex(bytes:Uint8Array){
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function same(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function verifiedSignature(raw:string,header:string){
  if(!secret||!header||raw.length>2_000_000)return false;
  const fields=header.split(",").map(part=>part.trim().split("="));
  const t=fields.find(x=>x[0]==="t")?.[1]||"";
  const sigs=fields.filter(x=>x[0]==="v1").map(x=>x[1]||"");
  if(!/^\d{10}$/.test(t)||!sigs.length||Math.abs(Date.now()/1000-Number(t))>300)return false;
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=await crypto.subtle.sign("HMAC",key,encoder.encode(t+"."+raw));
  const expected=hex(new Uint8Array(signed));
  return sigs.some(s=>/^[a-f0-9]{64}$/i.test(s)&&same(expected,s.toLowerCase()));
}
const validId=(value:unknown)=>typeof value==="string"&&value.length>0&&value.length<=128;
const take=(value:unknown,limit:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=limit?value:null;
const string=(value:unknown)=>typeof value==="string"?value:"";
function yyyyMmDd(value:unknown){
  const txt=string(value);
  const day=txt.slice(0,10);
  return /^20\d{2}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+"T12:00:00Z"))?day:null;
}
Deno.serve(async(req)=>{
  if(req.method!=="POST")return json(405,{error:"method_not_allowed"});
  if(!secret||!url||!service)return json(503,{error:"webhook_not_configured"});
  const size=Number(req.headers.get("content-length")||0);
  if(size>2_000_000)return json(413,{error:"too_large"});
  const raw=await req.text().catch(()=>"");
  if(!raw||raw.length>2_000_000)return json(413,{error:"too_large"});
  if(!await verifiedSignature(raw,req.headers.get("terra-signature")||""))return json(401,{error:"invalid_signature"});
  let event:Record<string,unknown>;
  try{event=JSON.parse(raw);if(!event||Array.isArray(event)||typeof event!=="object")throw Error();}
  catch(_){return json(400,{error:"invalid_json"});}
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const kind=string(event.type);
  if(kind==="healthcheck")return json(200,{received:true});
  const user=event.user&&typeof event.user==="object"&&!Array.isArray(event.user)?event.user as Record<string,unknown>:{};
  const terraId=user.user_id;
  if(kind==="auth"){
    const ref=event.reference_id||user.reference_id;
    if(!validId(terraId)||typeof ref!=="string"||!/^[a-f0-9-]{36}$/i.test(ref))
      return json(400,{error:"invalid_auth"});
    const {data:request,error}=await db.from("hg_terra_link_requests").select("id,user_id,expires_at,consumed_at")
      .eq("id",ref).maybeSingle();
    if(error)return json(503,{error:"database_unavailable"});
    // A signed webhook without a pending, unexpired user-generated reference
    // must never link a provider account to a guessed HealthGo user.
    if(!request||request.consumed_at||Date.parse(request.expires_at)<Date.now())
      return json(200,{received:true,linked:false});
    const existing=await db.from("hg_terra_connections").select("id,user_id").eq("terra_user_id",terraId).maybeSingle();
    if(existing.error)return json(503,{error:"database_unavailable"});
    if(existing.data&&existing.data.user_id!==request.user_id)return json(409,{error:"connection_owner_conflict"});
    const data={user_id:request.user_id,terra_user_id:terraId,
      provider:string(user.provider).slice(0,80)||"UNKNOWN",status:"connected",updated_at:new Date().toISOString()};
    const saved=existing.data?
      await db.from("hg_terra_connections").update(data).eq("id",existing.data.id).eq("user_id",request.user_id):
      await db.from("hg_terra_connections").insert(data);
    if(saved.error)return json(503,{error:"database_unavailable"});
    const consumed=await db.from("hg_terra_link_requests").update({consumed_at:new Date().toISOString()})
      .eq("id",ref).eq("user_id",request.user_id).is("consumed_at",null);
    if(consumed.error)return json(503,{error:"database_unavailable"});
    return json(200,{received:true,linked:true});
  }
  if(!validId(terraId))return json(200,{received:true,linked:false});
  const {data:link,error}=await db.from("hg_terra_connections")
    .select("id,user_id,status").eq("terra_user_id",terraId).maybeSingle();
  if(error)return json(503,{error:"database_unavailable"});
  if(!link)return json(200,{received:true,linked:false});
  if(["deauth","access_revoked"].includes(kind)){
    const metrics=await db.from("hg_terra_daily_metrics").delete().eq("connection_id",link.id);
    if(metrics.error)return json(503,{error:"database_unavailable"});
    const upd=await db.from("hg_terra_connections").update({status:"revoked",updated_at:new Date().toISOString()})
      .eq("id",link.id);
    return upd.error?json(503,{error:"database_unavailable"}):json(200,{received:true});
  }
  if(link.status!=="connected")return json(200,{received:true,linked:false});
  if(kind!=="daily")return json(200,{received:true});
  const items=Array.isArray(event.data)?event.data.slice(0,45):[];
  for(const item of items){
    if(!item||typeof item!=="object"||Array.isArray(item))continue;
    const data=item as Record<string,unknown>;
    const meta=(data.metadata||{}) as Record<string,unknown>;
    const day=yyyyMmDd(meta.start_time);
    if(!day)continue;
    const summary=(data.distance_data as Record<string,unknown>||{}).summary as Record<string,unknown>||{};
    const active=(data.active_durations_data||{}) as Record<string,unknown>;
    const steps=take(summary.steps,200000);
    const distance=take(summary.distance_meters,1000000);
    const seconds=take(active.activity_seconds,86400);
    if(steps===null&&distance===null&&seconds===null)continue;
    // Upsert the most recent provider snapshot per provider/day. Do not touch
    // activity_daily or XP: another source's measurements must not be overwritten.
    const row={connection_id:link.id,user_id:link.user_id,activity_date:day,
      steps:steps===null?null:Math.round(steps),
      distance_meters:distance,
      active_minutes:seconds===null?null:Math.round(seconds/60),
      updated_at:new Date().toISOString()};
    const saved=await db.from("hg_terra_daily_metrics").upsert(row,{onConflict:"connection_id,activity_date"});
    if(saved.error)return json(503,{error:"daily_write_failed"});
  }
  const updated=await db.from("hg_terra_connections").update({last_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    .eq("id",link.id);
  return updated.error?json(503,{error:"database_unavailable"}):json(200,{received:true});
});
