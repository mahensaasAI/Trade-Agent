// Node: Prepare Chat (Code) — identifies the caller (guest id or session row from ys_sessions), validates the
// chat request and builds the ONE live-context query for the selected agent.
function readToken(j){var h=j.headers||{};var a=h.authorization||h.Authorization||"";if(a.indexOf("Bearer ")===0)return a.slice(7).trim();return String((j.body||{}).token||"").trim();}
function readGuest(j){var h=j.headers||{};var g=String(h["x-guest-id"]||h["X-Guest-Id"]||(j.body||{}).guestId||"").trim();return /^guest-[a-z0-9]{6,40}$/i.test(g)?g.toLowerCase():"";}
function str(v,max){if(v==null)return null;var x=String(v).trim();if(!x)return null;return max?x.slice(0,max):x;}
function deny(code,msg){return [{json:{denied:true,provider:"denied",code:code,message:msg,sql:"SELECT 1 AS ok",params:[]}}];}
var j=$('Chat Request').first().json;var b=j.body||{};
var s=($input.first()||{}).json||{};
var t=readToken(j);var guestId=readGuest(j);var actor=null;
if(t){
 if(!s.id)return deny("INVALID_SESSION","Your session is no longer valid or has expired. Please sign in again.");
 if(s.active===false)return deny("ACCOUNT_DISABLED","This account has been deactivated.");
 var eff=(s.plan==="premium"&&(!s.plan_expires_at||new Date(s.plan_expires_at).getTime()>Date.now()))?"premium":"free";
 actor={id:s.id,name:s.name,email:s.email,role:s.role,plan:eff,kind:"member"};
}else if(guestId){actor={id:guestId,name:str(b.guestName,60)||"Guest",email:null,role:"guest",plan:"free",kind:"guest"};}
else return deny("UNAUTHENTICATED","No guest id or session was supplied. Reload the page and try again.");
var AGENT_IDS=["agent-athlete","agent-studypals","agent-events"];
var agentId=String(b.agentId||"agent-athlete");if(AGENT_IDS.indexOf(agentId)<0)agentId="agent-athlete";
var msg=String(b.message||"").trim().slice(0,6000);
if(!msg)return deny("INVALID_REQUEST","Please type something first.");
var conversationId=String(b.conversationId||("conv-"+Date.now().toString(36))).slice(0,80);
var requestedModel=String(b.model||"").trim().toLowerCase().slice(0,40);
var c=(b.context&&typeof b.context==="object")?b.context:{};
var eventId=str(c.eventId,40);
var context={eventId:eventId,grade:str(c.grade,10),subject:str(c.subject,60),topic:str(c.topic,120),studentId:str(c.studentId,80)};
var sql="SELECT json_build_object("+
 "'profile',(SELECT row_to_json(p) FROM ys_athlete_profiles p WHERE p.owner_id=$1),"+
 "'knowledge',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT id,title,category,content FROM ys_knowledge WHERE agent_id=$2 ORDER BY (to_tsvector('english',title||' '||content) @@ plainto_tsquery('english',$3)) DESC, ts_rank_cd(to_tsvector('english',title||' '||content), plainto_tsquery('english',$3)) DESC, CASE WHEN category IN ('Safety','Timing','Playbook') THEN 0 ELSE 1 END, id LIMIT 6) x),"+
 "'event',(SELECT CASE WHEN $4::text IS NOT NULL AND EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=$4 AND em.member_id=$1) THEN ys_event_detail($4) ELSE NULL END),"+
 "'myEvents',(SELECT coalesce(json_agg(e ORDER BY e.starts_at NULLS LAST),'[]'::json) FROM (SELECT ev.id,ev.title,ev.type,ev.starts_at,ev.venue,ev.status,ev.expected_guests,m.role AS my_role,(SELECT count(*) FROM ys_event_members x WHERE x.event_id=ev.id AND x.rsvp='yes') AS going,(SELECT count(*) FROM ys_event_tasks t WHERE t.event_id=ev.id AND t.status<>'done') AS open_tasks FROM ys_events ev JOIN ys_event_members m ON m.event_id=ev.id AND m.member_id=$1 WHERE $2='agent-events' LIMIT 8) e),"+
 "'usage',(SELECT coalesce(messages,0) FROM ys_usage WHERE owner_id=$1 AND day=current_date),"+
 "'limits',(SELECT value FROM ys_settings WHERE key='limits'),"+
 "'studypals',(SELECT value FROM ys_settings WHERE key='studypals'),"+
 "'organization',(SELECT value FROM ys_settings WHERE key='organization'),"+
 "'agentSetting',(SELECT default_model FROM ys_agent_settings WHERE agent_id=$2),"+
 "'models',(SELECT coalesce(json_agg(m ORDER BY m.sort),'[]'::json) FROM (SELECT id,provider,label,model_id,tier,sort FROM ys_models WHERE enabled) m)"+
 ") AS d";
var kbQuery=msg.slice(0,200);
var params=[actor.id,agentId,kbQuery,eventId];
return [{json:{denied:false,agentId:agentId,message:msg,conversationId:conversationId,requestedModel:requestedModel,actor:actor,context:context,startedAt:Date.now(),sql:sql,params:params}}];
