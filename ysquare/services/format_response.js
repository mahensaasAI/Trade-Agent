// Node: Format Response (Code) — turns query rows into the API envelope, creates sessions for signup / login /
// Google sign-in (persisted by the next node into ys_sessions) and maps database errors to friendly messages.
var AGENTS=[
 {id:"agent-athlete",name:"Athlete Edge",title:"What to eat for your sport",icon:"bolt",color:"#e0562b",type:"Nutrition",
  description:"The go-to guide for young athletes: what to eat and drink before, during and after training, games and tournaments, matched to the sport, age group and diet in the athlete profile.",
  capabilities:["Pre-game and post-game meals","Tournament and multi-game days","Hydration guide","Sport-specific fuelling","Vegetarian, halal and allergy-safe swaps","Weekly meal timeline"],
  starters:["What should I eat before a 10am soccer match?","Plan my food for a full-day basketball tournament.","Give me three quick recovery snacks after evening swim practice.","I train at 6am - what can I eat that early?"],
  supportsModels:true,needsProfile:true},
 {id:"agent-studypals",name:"StudyPals",title:"Personal tutor grounded in class materials",icon:"book",color:"#2563eb",type:"Learning",
  description:"Your StudyPals tutor: explains topics step by step using the curriculum and the materials your teacher uploaded, with hints before answers.",
  capabilities:["Ask about any topic in your grade","Socratic hints, not just answers","Grounded in teacher materials","Quiz and lesson generators (in StudyPals)"],
  starters:["Explain fractions with a real-life example.","Help me understand photosynthesis step by step.","Quiz me on the water cycle.","What is the difference between speed and velocity?"],
  supportsModels:false,external:true},
 {id:"agent-events",name:"Event Planner",title:"Logistics, information and communication in one place",icon:"cal",color:"#0d8a5f",type:"Events",
  description:"Plan and run events without endless WhatsApp threads: one space for the checklist, roles, budget, announcements, RSVPs and the event chat, with an AI planner that drafts the plan and the messages.",
  capabilities:["Checklist and timeline from a short brief","Roles and volunteer plan","Food and budget estimates","Announcement drafts","RSVP and headcount tracking","Event chat replaces group threads"],
  starters:["Create a checklist for a 100-person community sports day in 3 weeks.","Draft the RSVP reminder announcement for this event.","What is still open and overdue for this event?","Estimate food and drink quantities for 80 adults and 40 kids."],
  supportsModels:true,needsEvent:true}
];
var r=$('Route Request').first().json;
var rows=$input.all().map(function(i){return i.json;});
var rid=r.requestId||("req-"+Date.now().toString(36));
var NOOP="SELECT 1 AS ok";
function out(envelope,sessionSql,sessionParams){return [{json:{response:envelope,sessionSql:sessionSql||NOOP,sessionParams:sessionParams||[]}}];}
function fail(code,msg,detail){return out({success:false,requestId:rid,error:{code:code,message:msg,detail:detail}});}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,plan:u.effective_plan||u.plan||"free",planExpiresAt:u.plan_expires_at||null,initials:u.initials,avatarUrl:u.avatar_url||null,authProvider:u.auth_provider||"email",kind:"member"};}
function newSession(u){
 var token="",abc="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
 for(var n=0;n<48;n++){token+=abc.charAt(Math.floor(Math.random()*abc.length));}
 var sql="WITH gone AS (DELETE FROM ys_sessions WHERE exp < now()), seen AS (UPDATE ys_users SET last_login=now() WHERE id=$2) INSERT INTO ys_sessions (token_hash,user_id,name,email,role,initials,exp) VALUES (md5($1),$2,$3,$4,$5,$6,now() + interval '24 hours')";
 return {token:token,sql:sql,params:[token,u.id,u.name,u.email,u.role,u.initials||""]};
}
if(r.denied)return fail(r.code,r.message);
var first=rows[0]||{};
if(first.error){
 var em=(typeof first.error==="string")?first.error:(first.error.message||first.error.description||JSON.stringify(first.error));
 var friendly="Unable to complete this request right now. Please try again.";
 if(/duplicate key/i.test(em)&&/email/i.test(em))friendly="An account with that email already exists. Sign in instead.";
 else if(/does not exist/i.test(em))friendly="The database schema is missing something. Run the Y Square DB Migration and DB Functions workflows and try again.";
 return fail("DB_ERROR",friendly,String(em).slice(0,300));
}
if(r.action==="signup"||r.action==="login.google"){
 var nu=first;
 if(!nu||!nu.id){return fail(r.action==="login.google"?"GOOGLE_NOT_CONFIGURED":"SIGNUP_FAILED",r.action==="login.google"?"Google sign-in is not configured for this site (client id mismatch). Ask an administrator.":"Sign-up failed. Please try again.");}
 if(nu.active===false)return fail("ACCOUNT_DISABLED","This account has been deactivated.");
 var ns=newSession(nu);
 return out({success:true,requestId:rid,action:r.action,data:{token:ns.token,expiresIn:24*3600*1000,user:publicUser(nu),migrated:Number(nu.migrated||0)}},ns.sql,ns.params);
}
if(r.action==="login"){
 var u=first;
 if(!u||!u.id||!u.password_hash||String(u.password_hash).toLowerCase()!==r.passwordHash){
  if(u&&u.id&&!u.password_hash&&u.auth_provider==="google")return fail("USE_GOOGLE","This account signs in with Google. Use the Google button.");
  return fail("INVALID_CREDENTIALS","That email and password combination was not recognised.");
 }
 if(u.active===false)return fail("ACCOUNT_DISABLED","This account has been deactivated.");
 var ls=newSession(u);
 return out({success:true,requestId:rid,action:"login",data:{token:ls.token,expiresIn:24*3600*1000,user:publicUser(u)}},ls.sql,ls.params);
}
if(r.action==="logout")return out({success:true,requestId:rid,action:"logout",data:{signedOut:true}});
var data;
if(first.d!==undefined)data=first.d;else if(r.meta&&r.meta.list)data=rows.filter(function(x){return x&&Object.keys(x).length;});else data=first;
if(r.action==="bootstrap"){
 data=data||{};
 data.actor=Object.assign({},r.actor);
 data.agents=AGENTS;
 data.serverTime=new Date().toISOString();
}
if(r.action==="events.get"&&(!data||!data.event))return fail("NOT_FOUND","That event was not found, or you are not a member of it. Join it with its event code first.");
if(r.action==="events.join"&&(!data||!data.eventId))return fail("NOT_FOUND","No event with that code. Check the code with the organiser.");
if(r.action==="events.update"&&data&&!data.event)return fail("FORBIDDEN","Only an organiser can change the event details.");
if(r.action==="tasks.create"&&data&&data.allowed===false)return fail("FORBIDDEN","Join the event before adding tasks.");
if(r.action==="tasks.update"&&data&&!data.task)return fail("NOT_FOUND","That task was not found, or you are not a member of its event.");
if(r.action==="updates.post"&&data&&!data.update)return fail("FORBIDDEN","Only organisers and helpers can post updates. Ask the organiser to make you a helper.");
if(r.action==="updates.pin"&&data&&!data.update)return fail("FORBIDDEN","Only organisers and helpers can pin updates.");
if(r.action==="messages.post"&&data&&!data.message)return fail("FORBIDDEN","Join the event before posting in its chat.");
if(r.action==="rsvp.set"&&data&&!data.member)return fail("NOT_FOUND","You are not a member of that event.");
if(r.action==="members.set_role"&&data&&!data.member)return fail("FORBIDDEN","Only an organiser can change roles.");
if(r.action==="users.set_plan"&&data&&!data.user)return fail("NOT_FOUND","That user was not found.");
if(r.action==="users.update"&&data&&!data.user)return fail("NOT_FOUND","That user was not found.");
if(r.action==="billing.checkout"){
 var b=(data&&data.billing)||{};var bu=(data&&data.user)||{};
 var url=String(b.checkoutUrl||"").trim();
 if(!url)return fail("BILLING_NOT_CONFIGURED","Online payment is not set up yet. Contact the Y Square team to activate Premium.");
 url+=(url.indexOf("?")>=0?"&":"?")+"prefilled_email="+encodeURIComponent(bu.email||"")+"&client_reference_id="+encodeURIComponent(bu.id||"");
 data={url:url,priceLabel:b.priceLabel||"",provider:b.provider||"stripe_payment_link"};
}
return out({success:true,requestId:rid,action:r.action,data:data});
