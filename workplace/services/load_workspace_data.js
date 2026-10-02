// The workspace payload now comes from CloudSQL rather than literals in this node. Session handling is
// unchanged so the other authenticated endpoints, which read the same static-data store, keep working.
function sessions(){var sd=$getWorkflowStaticData('global');if(!sd.sessions)sd.sessions={};return sd.sessions;}
function readToken(j){
 var h=j.headers||{};
 var a=h.authorization||h.Authorization||"";
 if(a.indexOf("Bearer ")===0)return a.slice(7).trim();
 var b=j.body||{};
 return (b.token||"").toString().trim();
}
function authorize(j){
 var t=readToken(j);
 if(!t)return {ok:false,code:"UNAUTHENTICATED",message:"Sign in to access this workspace."};
 var s=sessions()[t];
 if(!s)return {ok:false,code:"INVALID_SESSION",message:"Your session is no longer valid. Please sign in again."};
 if(Date.now()>s.exp){delete sessions()[t];return {ok:false,code:"SESSION_EXPIRED",message:"Your session has expired. Please sign in again."};}
 return {ok:true,user:{id:s.id,name:s.name,email:s.email,role:s.role,initials:s.initials,isAdmin:!!s.isAdmin}};
}
function deny(a){return [{json:{success:false,requestId:"req-"+Date.now().toString(36),error:{code:a.code,message:a.message}}}];}

var a=authorize($('Bootstrap Request').first().json);
if(!a.ok)return deny(a);

var d=($input.first().json||{}).d||{};
if(!d.organization)return [{json:{success:false,requestId:"req-"+Date.now().toString(36),
 error:{code:"WORKSPACE_UNAVAILABLE",message:"The workspace could not be loaded from the database."}}}];

var models=Array.isArray(d.models)?d.models:[];
// Never advertise a model the organisation's plan does not include.
var plan=String((d.organization||{}).plan||"free").toLowerCase();
if(plan!=="premium")models=models.filter(function(m){return String(m.tier||"free")!=="premium";}).concat(
 models.filter(function(m){return String(m.tier||"free")==="premium";}));

return [{json:{success:true,requestId:"req-"+Date.now().toString(36),
 data:{
  models:models,
  organization:d.organization,
  user:a.user,
  kpis:d.kpis||{activeProjects:0,documents:0,agents:0,conversations:0},
  projects:Array.isArray(d.projects)?d.projects:[],
  agents:Array.isArray(d.agents)?d.agents:[],
  documents:Array.isArray(d.documents)?d.documents:[],
  activity:Array.isArray(d.activity)?d.activity:[]
 }}}];
