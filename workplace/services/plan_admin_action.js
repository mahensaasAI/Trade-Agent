// Node: Plan Admin Action (Code) - authorises the caller, checks the admin flag, and turns the
// requested action into one parameterised statement. Nothing here builds SQL from user input:
// the statements are fixed and every value travels as a bound parameter.
function sessions(){var sd=$getWorkflowStaticData('global');if(!sd.sessions)sd.sessions={};return sd.sessions;}
function readToken(j){
 var h=j.headers||{};
 var a=h.authorization||h.Authorization||"";
 if(a.indexOf("Bearer ")===0)return a.slice(7).trim();
 return String((j.body||{}).token||"").trim();
}
function authorize(j){
 var t=readToken(j);
 if(!t)return {ok:false,code:"UNAUTHENTICATED",message:"Sign in to manage access."};
 var s=sessions()[t];
 if(!s)return {ok:false,code:"INVALID_SESSION",message:"Your session is no longer valid. Please sign in again."};
 if(Date.now()>s.exp){delete sessions()[t];return {ok:false,code:"SESSION_EXPIRED",message:"Your session has expired. Please sign in again."};}
 return {ok:true,user:{id:s.id,name:s.name,email:s.email,isAdmin:!!s.isAdmin}};
}
function stop(code,message){return [{json:{denied:true,code:code,message:message,sql:"SELECT 1 AS ok",params:[]}}];}

var j=$input.first().json;
var a=authorize(j);
if(!a.ok)return stop(a.code,a.message);
if(!a.user.isAdmin)return stop("FORBIDDEN","Only an administrator can review access requests.");

var b=j.body||{};
var action=String(b.action||"list").toLowerCase();
var uid=String(b.userId||"").trim();

if(action==="list")
 return [{json:{denied:false,action:"list",actor:a.user.email,sql:"SELECT 1 AS ok",params:[]}}];

if(action!=="approve"&&action!=="reject")
 return stop("INVALID_ACTION","Unknown action. Expected list, approve or reject.");
if(!uid)return stop("INVALID_REQUEST","Which request? No user id was given.");
// An administrator who rejects their own account locks the approval queue behind a door only they
// could open, so that one is refused outright.
if(uid===a.user.id&&action==="reject")return stop("INVALID_REQUEST","You cannot reject your own account.");

if(action==="approve")
 return [{json:{denied:false,action:"approve",actor:a.user.email,
  sql:"UPDATE wp_users SET status='active', approved_by=$1, approved_at=now(), reason=NULL WHERE id=$2 RETURNING id, name, email, status",
  params:[a.user.email,uid]}}];

return [{json:{denied:false,action:"reject",actor:a.user.email,
 sql:"UPDATE wp_users SET status='rejected', approved_by=$1, approved_at=now(), reason=NULLIF($3,'') WHERE id=$2 RETURNING id, name, email, status",
 params:[a.user.email,uid,String(b.reason||"").trim().slice(0,300)]}}];
