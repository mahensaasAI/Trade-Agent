// Node: Route Request (Code) — identifies the caller (guest id, or a session row loaded from ys_sessions by Load
// Session), enforces the permission level of every action and turns it into ONE parameterised SQL statement.
// Levels: guest (no sign-up) < member (free account) < premium (paid) < admin.
function readToken(j){var h=j.headers||{};var a=h.authorization||h.Authorization||"";if(a.indexOf("Bearer ")===0)return a.slice(7).trim();return String((j.body||{}).token||"").trim();}
function readGuest(j){var h=j.headers||{};var g=String(h["x-guest-id"]||h["X-Guest-Id"]||(j.body||{}).guestId||"").trim();return /^guest-[a-z0-9]{6,40}$/i.test(g)?g.toLowerCase():"";}
var LEVELS={guest:0,member:1,premium:2,admin:3};
var PERM={
 "bootstrap":"guest","events.list":"guest","events.create":"guest","events.join":"guest","events.get":"guest","events.update":"guest",
 "tasks.create":"guest","tasks.update":"guest","updates.post":"guest","updates.pin":"guest","messages.post":"guest","rsvp.set":"guest","members.set_role":"guest",
 "profile.save":"guest","knowledge.search":"guest",
 "logout":"member","account.get":"member","billing.checkout":"member",
 "admin.overview":"admin","users.set_plan":"admin","users.update":"admin","models.update":"admin","agents.set_model":"admin","settings.update":"admin","agents.runs":"admin"
};
var OPEN=["signup","login","login.google"];
function deny(code,msg,action){return [{json:{denied:true,code:code,message:msg,action:action||"",sql:"SELECT 1 AS ok",params:[]}}];}
function str(v,max){if(v==null)return null;var x=String(v).trim();if(!x)return null;return max?x.slice(0,max):x;}
function num(v,d){var n=Number(v);return isFinite(n)?n:d;}
function initials(n){return String(n||"").split(/\s+/).slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase()||"Y";}

var j=$('Hash Password').first().json;
var sess=($('Load Session').first()||{}).json||{};
var body=j.body||{};
var action=String(body.action||"").trim();
var p=body.payload||{};
var rid="req-"+Date.now().toString(36);
if(!action)return deny("MISSING_ACTION","No action was supplied.");
var guestId=readGuest(j);
var guestName=str(p.guestName||body.guestName,60);

// ---- open actions -------------------------------------------------------------------------------------------
if(action==="signup"){
 var sname=str(p.name,120),semail=String(p.email||"").trim().toLowerCase();
 if(!sname||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(semail)||!p.password||String(p.password).length<8)return deny("INVALID_REQUEST","Name, a valid email and a password of at least 8 characters are required.",action);
 return [{json:{denied:false,action:action,requestId:rid,email:semail,
  sql:"WITH u AS (INSERT INTO ys_users (id,name,email,role,plan,initials,password_hash,auth_provider,active,last_login) VALUES ('user-'||substr(md5(random()::text||clock_timestamp()::text),1,10),$1,$2,'member','free',$3,$4,'email',true,now()) RETURNING *), "+
   "me AS (UPDATE ys_events SET owner_id=(SELECT id FROM u), owner_name=(SELECT name FROM u) WHERE $5<>'' AND owner_id=$5 RETURNING id), "+
   "mm AS (UPDATE ys_event_members SET member_id=(SELECT id FROM u), name=(SELECT name FROM u) WHERE $5<>'' AND member_id=$5 RETURNING event_id), "+
   "mp AS (UPDATE ys_athlete_profiles SET owner_id=(SELECT id FROM u), updated_at=now() WHERE $5<>'' AND owner_id=$5 RETURNING owner_id), "+
   "mg AS (UPDATE ys_guests SET converted_user_id=(SELECT id FROM u) WHERE $5<>'' AND id=$5 RETURNING id), "+
   "act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,icon) SELECT u.name,'user','signed up','user',u.id,u.email,'users' FROM u RETURNING id) "+
   "SELECT u.*, (SELECT count(*) FROM me)+(SELECT count(*) FROM mm)+(SELECT count(*) FROM mp) AS migrated FROM u",
  params:[sname,semail,initials(sname),String(j.passwordHash||"").toLowerCase(),guestId||""]}}];
}
if(action==="login"){
 var email=String(p.email||"").trim().toLowerCase();
 if(!email||!p.password)return deny("MISSING_CREDENTIALS","Email and password are required.","login");
 return [{json:{denied:false,action:"login",requestId:rid,passwordHash:String(j.passwordHash||"").toLowerCase(),email:email,guestId:guestId||"",
  sql:"SELECT id,name,email,role,plan,plan_expires_at,initials,active,password_hash,auth_provider,avatar_url,ys_effective_plan(plan,plan_expires_at) AS effective_plan FROM ys_users WHERE lower(email)=$1",params:[email]}}];
}
if(action==="login.google"){
 var g=($input.first()||{}).json||{};
 if(g.error||!g.sub||!g.email)return deny("GOOGLE_TOKEN_INVALID","Google did not accept that sign-in token. Please try again.",action);
 if(String(g.email_verified)!=="true")return deny("GOOGLE_EMAIL_UNVERIFIED","Your Google email address is not verified.",action);
 var gname=str(g.name,120)||String(g.email).split("@")[0];
 return [{json:{denied:false,action:action,requestId:rid,guestId:guestId||"",
  sql:"WITH cfg AS (SELECT coalesce(value->>'googleClientId','') AS cid FROM ys_settings WHERE key='auth'), "+
   "u AS (INSERT INTO ys_users (id,name,email,role,plan,initials,auth_provider,google_sub,avatar_url,active,last_login) SELECT 'user-'||substr(md5(random()::text||clock_timestamp()::text),1,10),$1,$2,'member','free',$3,'google',$4,$5,true,now() WHERE (SELECT cid FROM cfg)='' OR (SELECT cid FROM cfg)=$6 "+
   "ON CONFLICT (email) DO UPDATE SET google_sub=coalesce(ys_users.google_sub,EXCLUDED.google_sub), avatar_url=coalesce(EXCLUDED.avatar_url,ys_users.avatar_url), last_login=now(), updated_at=now() RETURNING *), "+
   "me AS (UPDATE ys_events SET owner_id=(SELECT id FROM u), owner_name=(SELECT name FROM u) WHERE $7<>'' AND owner_id=$7 AND EXISTS (SELECT 1 FROM u) RETURNING id), "+
   "mm AS (UPDATE ys_event_members SET member_id=(SELECT id FROM u), name=(SELECT name FROM u) WHERE $7<>'' AND member_id=$7 AND EXISTS (SELECT 1 FROM u) AND NOT EXISTS (SELECT 1 FROM ys_event_members z WHERE z.event_id=ys_event_members.event_id AND z.member_id=(SELECT id FROM u)) RETURNING event_id), "+
   "mp AS (UPDATE ys_athlete_profiles SET owner_id=(SELECT id FROM u), updated_at=now() WHERE $7<>'' AND owner_id=$7 AND EXISTS (SELECT 1 FROM u) AND NOT EXISTS (SELECT 1 FROM ys_athlete_profiles z WHERE z.owner_id=(SELECT id FROM u)) RETURNING owner_id), "+
   "mg AS (UPDATE ys_guests SET converted_user_id=(SELECT id FROM u) WHERE $7<>'' AND id=$7 AND EXISTS (SELECT 1 FROM u) RETURNING id) "+
   "SELECT u.*, ys_effective_plan(u.plan,u.plan_expires_at) AS effective_plan, (SELECT cid FROM cfg) AS expected_aud FROM u",
  params:[gname,String(g.email).toLowerCase(),initials(gname),String(g.sub),str(g.picture,400),String(g.aud||""),guestId||""]}}];
}

// ---- actor resolution ---------------------------------------------------------------------------------------
var t=readToken(j);var actor=null;
if(t){
 if(!sess.id)return deny("INVALID_SESSION","Your session is no longer valid or has expired. Please sign in again.",action);
 if(sess.active===false)return deny("ACCOUNT_DISABLED","This account has been deactivated.",action);
 var eff=(sess.plan==="premium"&&(!sess.plan_expires_at||new Date(sess.plan_expires_at).getTime()>Date.now()))?"premium":"free";
 actor={id:sess.id,name:sess.name,email:sess.email,role:sess.role,plan:eff,initials:sess.initials,kind:"member",level:sess.role==="admin"?"admin":(eff==="premium"?"premium":"member")};
}else if(guestId){
 actor={id:guestId,name:guestName||"Guest",email:null,role:"guest",plan:"free",initials:initials(guestName||"Guest"),kind:"guest",level:"guest"};
}else return deny("UNAUTHENTICATED","No guest id or session was supplied. Reload the page and try again.",action);
if(!PERM[action])return deny("UNKNOWN_ACTION","Unknown action: "+action,action);
if(LEVELS[actor.level]<LEVELS[PERM[action]]){
 var need=PERM[action];
 var code=need==="admin"?"FORBIDDEN":(need==="premium"?"PREMIUM_REQUIRED":"SIGNUP_REQUIRED");
 var msg=need==="admin"?"This action is for administrators.":(need==="premium"?"This feature is part of Y Square Premium.":"Sign up (free) to use this feature.");
 return deny(code,msg,action);
}
if(action==="logout")return [{json:{denied:false,action:"logout",requestId:rid,actor:actor,sql:"DELETE FROM ys_sessions WHERE token_hash=md5($1)",params:[t],meta:{}}}];

var sql="",params=[],meta={};
var EVENT_TYPES=["community","sports","school","family","cultural","corporate","other"];
var EVENT_STATUSES=["planning","live","done","cancelled"];
var TASK_CATS=["logistics","venue","food","comms","budget","program","other"];
var TASK_STATUSES=["todo","doing","done"];
var PRIORITIES=["low","normal","high"];
var UPDATE_KINDS=["announcement","info","schedule","reminder"];
var RSVPS=["yes","no","maybe","pending"];
var MEMBER_ROLES=["organizer","helper","guest"];
var AGENT_IDS=["agent-athlete","agent-studypals","agent-events"];
var EVENT_LIST="SELECT ev.id,ev.code,ev.title,ev.type,ev.starts_at,ev.ends_at,ev.venue,ev.status,ev.owner_id,ev.owner_name,ev.expected_guests,m.role AS my_role,m.rsvp AS my_rsvp,(SELECT count(*) FROM ys_event_members x WHERE x.event_id=ev.id) AS members,(SELECT count(*) FROM ys_event_members x WHERE x.event_id=ev.id AND x.rsvp='yes') AS going,(SELECT count(*) FROM ys_event_tasks t WHERE t.event_id=ev.id AND t.status<>'done') AS open_tasks,(SELECT count(*) FROM ys_event_tasks t WHERE t.event_id=ev.id) AS tasks FROM ys_events ev JOIN ys_event_members m ON m.event_id=ev.id AND m.member_id=$1 ORDER BY CASE ev.status WHEN 'done' THEN 1 WHEN 'cancelled' THEN 2 ELSE 0 END, ev.starts_at NULLS LAST";
// A member of the event (any role) may read and coordinate; organizers may change the event itself.
var IS_MEMBER="EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=$1 AND em.member_id=$2)";
var IS_ORGANIZER="EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=$1 AND em.member_id=$2 AND em.role='organizer')";

switch(action){
 case "bootstrap":
  if(actor.kind==="guest"){sql="WITH g AS (INSERT INTO ys_guests (id,name,last_seen,requests) VALUES ($1,$2,now(),1) ON CONFLICT (id) DO UPDATE SET last_seen=now(), requests=ys_guests.requests+1, name=coalesce(EXCLUDED.name,ys_guests.name) RETURNING id) SELECT ys_bootstrap($1) AS d";params=[actor.id,guestName];}
  else{sql="SELECT ys_bootstrap($1) AS d";params=[actor.id];}
  break;
 case "account.get":
  sql="SELECT json_build_object('user',(SELECT row_to_json(x) FROM (SELECT id,name,email,role,plan,plan_expires_at,plan_source,auth_provider,avatar_url,initials,created_at,last_login,ys_effective_plan(plan,plan_expires_at) AS effective_plan FROM ys_users WHERE id=$1) x),'usage',(SELECT coalesce(json_agg(u ORDER BY u.day DESC),'[]'::json) FROM (SELECT day,messages FROM ys_usage WHERE owner_id=$1 ORDER BY day DESC LIMIT 14) u),'runs',(SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT agent_id,provider,model,status,duration_ms,at FROM ys_agent_runs WHERE owner_id=$1 ORDER BY at DESC LIMIT 20) r)) AS d";
  params=[actor.id];break;
 case "profile.save":
  var td=p.trainingDays==null||p.trainingDays===""?null:Math.max(0,Math.min(14,Math.round(num(p.trainingDays,0))));
  sql="WITH pr AS (INSERT INTO ys_athlete_profiles (owner_id,athlete_name,age_group,sport,position,training_days,session_time,goals,dietary_notes,favourite_foods,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) ON CONFLICT (owner_id) DO UPDATE SET athlete_name=EXCLUDED.athlete_name, age_group=EXCLUDED.age_group, sport=EXCLUDED.sport, position=EXCLUDED.position, training_days=EXCLUDED.training_days, session_time=EXCLUDED.session_time, goals=EXCLUDED.goals, dietary_notes=EXCLUDED.dietary_notes, favourite_foods=EXCLUDED.favourite_foods, updated_at=now() RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,icon) VALUES ($11,'user','updated athlete profile','profile',$1,coalesce($4,'')||' '||coalesce($3,''),'bolt') RETURNING id) SELECT json_build_object('profile',(SELECT row_to_json(pr) FROM pr)) AS d";
  params=[actor.id,str(p.athleteName,80),str(p.ageGroup,20),str(p.sport,60),str(p.position,60),td,str(p.sessionTime,20),str(p.goals,400),str(p.dietaryNotes,400),str(p.favouriteFoods,400),actor.name];break;
 case "knowledge.search":
  var kq=str(p.q,200),ka=str(p.agentId,40);if(!kq)return deny("INVALID_REQUEST","A search query is required.",action);
  sql="SELECT id,agent_id,title,category,content,tags,updated_at, ts_rank_cd(to_tsvector('english',title||' '||content), plainto_tsquery('english',$1)) AS rank FROM ys_knowledge WHERE ($2::text IS NULL OR agent_id=$2) AND (to_tsvector('english',title||' '||content) @@ plainto_tsquery('english',$1) OR title ILIKE '%'||$1||'%' OR content ILIKE '%'||$1||'%') ORDER BY rank DESC, title LIMIT 10";
  params=[kq,AGENT_IDS.indexOf(ka)>=0?ka:null];meta.list=true;break;
 case "events.list":
  sql=EVENT_LIST;params=[actor.id];meta.list=true;break;
 case "events.create":
  var et=str(p.title,140);if(!et)return deny("INVALID_REQUEST","An event title is required.",action);
  var etype=str(p.type,30);if(EVENT_TYPES.indexOf(etype)<0)etype="community";
  sql="WITH ev AS (INSERT INTO ys_events (id,code,title,type,description,starts_at,ends_at,venue,address,owner_id,owner_name,status,budget,expected_guests) VALUES ('EV-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,6)),upper(substr(md5(random()::text||clock_timestamp()::text||'code'),1,6)),$1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7,$8,$9,'planning',$10::numeric,$11::int) RETURNING *), "+
   "m AS (INSERT INTO ys_event_members (event_id,member_id,name,role,rsvp,party_size) SELECT ev.id,$8,$9,'organizer','yes',1 FROM ev RETURNING member_id), "+
   "act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,icon) SELECT $9,'user','created event','event',ev.id,ev.title,'cal' FROM ev RETURNING id) "+
   "SELECT json_build_object('event',(SELECT row_to_json(ev) FROM ev)) AS d";
  params=[et,etype,str(p.description,2000),str(p.startsAt,40),str(p.endsAt,40),str(p.venue,140),str(p.address,300),actor.id,actor.name,p.budget==null||p.budget===""?null:num(p.budget,null),p.expectedGuests==null||p.expectedGuests===""?null:Math.round(num(p.expectedGuests,0))];break;
 case "events.join":
  var code=str(p.code,12);if(!code)return deny("INVALID_REQUEST","An event code is required.",action);
  sql="WITH ev AS (SELECT id,title FROM ys_events WHERE upper(code)=upper($1) AND status<>'cancelled' LIMIT 1), m AS (INSERT INTO ys_event_members (event_id,member_id,name,role,rsvp,party_size,contact) SELECT ev.id,$2,$3,'guest','pending',1,$4 FROM ev ON CONFLICT (event_id,member_id) DO UPDATE SET name=coalesce(EXCLUDED.name,ys_event_members.name) RETURNING event_id), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,icon) SELECT $3,'user','joined event','event',ev.id,ev.title,'users' FROM ev RETURNING id) SELECT json_build_object('eventId',(SELECT id FROM ev),'title',(SELECT title FROM ev)) AS d";
  params=[code,actor.id,actor.name,str(p.contact,120)];break;
 case "events.get":
  var eid=str(p.eventId,40);if(!eid)return deny("INVALID_REQUEST","eventId is required.",action);
  sql="SELECT CASE WHEN "+IS_MEMBER+" THEN ys_event_detail($1) ELSE NULL END AS d";params=[eid,actor.id];break;
 case "events.update":
  var uid=str(p.eventId,40);if(!uid)return deny("INVALID_REQUEST","eventId is required.",action);
  var ust=str(p.status,20);if(ust&&EVENT_STATUSES.indexOf(ust)<0)return deny("INVALID_REQUEST","Unknown event status.",action);
  var utype=str(p.type,30);if(utype&&EVENT_TYPES.indexOf(utype)<0)utype=null;
  sql="WITH ev AS (UPDATE ys_events SET title=coalesce($3,title), type=coalesce($4,type), description=coalesce($5,description), starts_at=coalesce($6::timestamptz,starts_at), ends_at=coalesce($7::timestamptz,ends_at), venue=coalesce($8,venue), address=coalesce($9,address), status=coalesce($10,status), budget=coalesce($11::numeric,budget), expected_guests=coalesce($12::int,expected_guests), updated_at=now() WHERE id=$1 AND "+IS_ORGANIZER+" RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $13,'user','updated event','event',ev.id,ev.title,coalesce($10,''),'cal' FROM ev RETURNING id) SELECT json_build_object('event',(SELECT row_to_json(ev) FROM ev)) AS d";
  params=[uid,actor.id,str(p.title,140),utype,str(p.description,2000),str(p.startsAt,40),str(p.endsAt,40),str(p.venue,140),str(p.address,300),ust,p.budget==null||p.budget===""?null:num(p.budget,null),p.expectedGuests==null||p.expectedGuests===""?null:Math.round(num(p.expectedGuests,0)),actor.name];break;
 case "tasks.create":
  var teid=str(p.eventId,40);if(!teid)return deny("INVALID_REQUEST","eventId is required.",action);
  var list=Array.isArray(p.tasks)?p.tasks:[p];var rows=[];params=[teid,actor.id,actor.name];
  list.slice(0,25).forEach(function(tk){var tt=str(tk.title,200);if(!tt)return;var cat=str(tk.category,20);if(TASK_CATS.indexOf(cat)<0)cat="logistics";var pr=str(tk.priority,10);if(PRIORITIES.indexOf(pr)<0)pr="normal";var b=params.length;params.push(tt,cat,str(tk.assignee,80),str(tk.dueAt,40),pr,str(tk.notes,1000));rows.push("('TK-'||upper(substr(md5(random()::text||clock_timestamp()::text||'"+b+"'),1,8)),$1,$"+(b+1)+",$"+(b+2)+",$"+(b+3)+",$"+(b+4)+"::timestamptz,'todo',$"+(b+5)+",$"+(b+6)+",$3)");});
  if(!rows.length)return deny("INVALID_REQUEST","At least one task with a title is required.",action);
  sql="WITH ok AS (SELECT "+IS_MEMBER+" AS allowed), ins AS (INSERT INTO ys_event_tasks (id,event_id,title,category,assignee,due_at,status,priority,notes,created_by) SELECT * FROM (VALUES "+rows.join(",")+") v WHERE (SELECT allowed FROM ok) RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $3,'user','added '||(SELECT count(*) FROM ins)||' task(s) to','event',$1,(SELECT title FROM ys_events WHERE id=$1),(SELECT string_agg(title,', ') FROM ins),'chk' WHERE EXISTS (SELECT 1 FROM ins) RETURNING id) SELECT json_build_object('tasks',(SELECT coalesce(json_agg(ins),'[]'::json) FROM ins),'allowed',(SELECT allowed FROM ok)) AS d";
  break;
 case "tasks.update":
  var tid=str(p.taskId,40);if(!tid)return deny("INVALID_REQUEST","taskId is required.",action);
  var tst=str(p.status,10);if(tst&&TASK_STATUSES.indexOf(tst)<0)return deny("INVALID_REQUEST","Unknown task status.",action);
  var tcat=str(p.category,20);if(tcat&&TASK_CATS.indexOf(tcat)<0)tcat=null;var tpr=str(p.priority,10);if(tpr&&PRIORITIES.indexOf(tpr)<0)tpr=null;
  sql="WITH t AS (UPDATE ys_event_tasks x SET title=coalesce($3,title), category=coalesce($4,category), assignee=CASE WHEN $5::text IS NULL THEN assignee ELSE NULLIF($5,'-') END, due_at=CASE WHEN $6::text IS NULL THEN due_at ELSE NULLIF($6,'-')::timestamptz END, status=coalesce($7,status), priority=coalesce($8,priority), notes=coalesce($9,notes), updated_at=now() WHERE x.id=$1 AND EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=x.event_id AND em.member_id=$2) RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $10,'user','updated task','task',t.id,t.title,t.status,'chk' FROM t RETURNING id) SELECT json_build_object('task',(SELECT row_to_json(t) FROM t)) AS d";
  params=[tid,actor.id,str(p.title,200),tcat,p.assignee===null?"-":str(p.assignee,80),p.dueAt===null?"-":str(p.dueAt,40),tst,tpr,str(p.notes,1000),actor.name];break;
 case "updates.post":
  var ueid=str(p.eventId,40),ut=str(p.title,160);if(!ueid||!ut)return deny("INVALID_REQUEST","eventId and a title are required.",action);
  var uk=str(p.kind,20);if(UPDATE_KINDS.indexOf(uk)<0)uk="announcement";
  sql="WITH u AS (INSERT INTO ys_event_updates (id,event_id,kind,title,body,pinned,author) SELECT 'UP-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,8)),$1,$3,$4,$5,$6::boolean,$7 WHERE EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=$1 AND em.member_id=$2 AND em.role IN ('organizer','helper')) RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $7,'user','posted an update on','event',$1,(SELECT title FROM ys_events WHERE id=$1),u.title,'mail' FROM u RETURNING id) SELECT json_build_object('update',(SELECT row_to_json(u) FROM u)) AS d";
  params=[ueid,actor.id,uk,ut,str(p.body,4000),p.pinned===true,actor.name];break;
 case "updates.pin":
  var upid=str(p.updateId,40);if(!upid)return deny("INVALID_REQUEST","updateId is required.",action);
  sql="WITH u AS (UPDATE ys_event_updates x SET pinned=$3::boolean WHERE x.id=$1 AND EXISTS (SELECT 1 FROM ys_event_members em WHERE em.event_id=x.event_id AND em.member_id=$2 AND em.role IN ('organizer','helper')) RETURNING *) SELECT json_build_object('update',(SELECT row_to_json(u) FROM u)) AS d";
  params=[upid,actor.id,p.pinned===true];break;
 case "messages.post":
  var meid=str(p.eventId,40),mb=str(p.body,2000);if(!meid||!mb)return deny("INVALID_REQUEST","eventId and a message are required.",action);
  sql="WITH m AS (INSERT INTO ys_event_messages (event_id,author_id,author,body) SELECT $1,$2,$3,$4 WHERE "+IS_MEMBER+" RETURNING *) SELECT json_build_object('message',(SELECT row_to_json(m) FROM m)) AS d";
  params=[meid,actor.id,actor.name,mb];break;
 case "rsvp.set":
  var reid=str(p.eventId,40),rv=str(p.rsvp,10);if(!reid||RSVPS.indexOf(rv)<0)return deny("INVALID_REQUEST","eventId and a valid rsvp (yes, no, maybe) are required.",action);
  sql="WITH m AS (UPDATE ys_event_members SET rsvp=$3, party_size=coalesce($4::int,party_size), contact=coalesce($5,contact), name=coalesce($6,name) WHERE event_id=$1 AND member_id=$2 RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $6,'user','replied '||$3||' to','event',$1,(SELECT title FROM ys_events WHERE id=$1),$3,'users' FROM m RETURNING id) SELECT json_build_object('member',(SELECT row_to_json(m) FROM m)) AS d";
  params=[reid,actor.id,rv,p.partySize==null||p.partySize===""?null:Math.max(1,Math.min(50,Math.round(num(p.partySize,1)))),str(p.contact,120),actor.name];break;
 case "members.set_role":
  var seid=str(p.eventId,40),smid=str(p.memberId,60),srole=str(p.role,20);if(!seid||!smid||MEMBER_ROLES.indexOf(srole)<0)return deny("INVALID_REQUEST","eventId, memberId and a valid role are required.",action);
  sql="WITH m AS (UPDATE ys_event_members SET role=$4 WHERE event_id=$1 AND member_id=$3 AND "+IS_ORGANIZER+" RETURNING *) SELECT json_build_object('member',(SELECT row_to_json(m) FROM m)) AS d";
  params=[seid,actor.id,smid,srole];break;
 case "billing.checkout":
  sql="SELECT json_build_object('billing',(SELECT value FROM ys_settings WHERE key='billing'),'user',(SELECT row_to_json(x) FROM (SELECT id,email,name,plan,plan_expires_at FROM ys_users WHERE id=$1) x)) AS d";params=[actor.id];break;
 case "admin.overview":
  sql="SELECT ys_admin_overview() AS d";break;
 case "users.set_plan":
  var puid=str(p.userId,40),plan=str(p.plan,10);if(!puid||["free","premium"].indexOf(plan)<0)return deny("INVALID_REQUEST","userId and plan (free or premium) are required.",action);
  var months=p.months==null||p.months===""?null:Math.max(0,Math.min(120,Math.round(num(p.months,0))));
  sql="WITH u AS (UPDATE ys_users SET plan=$2, plan_source='admin', plan_expires_at=CASE WHEN $2='free' THEN NULL WHEN $3::int IS NULL THEN NULL ELSE now()+($3::int||' months')::interval END, updated_at=now() WHERE id=$1 RETURNING id,name,email,plan,plan_expires_at), s AS (UPDATE ys_sessions SET role=role WHERE user_id=$1 RETURNING token_hash), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $4,'user','changed the plan of','user',u.id,u.name,u.plan,'star' FROM u RETURNING id) SELECT json_build_object('user',(SELECT row_to_json(u) FROM u)) AS d";
  params=[puid,plan,months,actor.name];break;
 case "users.update":
  var tuid=str(p.userId,40);if(!tuid)return deny("INVALID_REQUEST","userId is required.",action);
  var nrole=str(p.role,20);if(nrole&&["member","admin"].indexOf(nrole)<0)return deny("INVALID_REQUEST","Unknown role.",action);
  if(tuid===actor.id&&p.active===false)return deny("INVALID_REQUEST","You cannot deactivate your own account.",action);
  sql="WITH u AS (UPDATE ys_users SET name=coalesce($2,name), role=coalesce($3,role), active=coalesce($4::boolean,active), updated_at=now() WHERE id=$1 RETURNING id,name,email,role,plan,active), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $5,'user','updated user','user',u.id,u.name,u.role||CASE WHEN u.active THEN '' ELSE ' (deactivated)' END,'users' FROM u RETURNING id) SELECT json_build_object('user',(SELECT row_to_json(u) FROM u)) AS d";
  params=[tuid,str(p.name,120),nrole,(p.active===true||p.active===false)?p.active:null,actor.name];break;
 case "models.update":
  var mid=str(p.id,40);if(!mid)return deny("INVALID_REQUEST","model id is required.",action);
  var tier=str(p.tier,10);if(tier&&["free","premium"].indexOf(tier)<0)tier=null;
  sql="WITH m AS (UPDATE ys_models SET enabled=coalesce($2::boolean,enabled), tier=coalesce($3,tier), model_id=coalesce($4,model_id), label=coalesce($5,label), description=coalesce($6,description) WHERE id=$1 RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT $7,'user','updated model','model',m.id,m.label,m.model_id||' / '||m.tier||CASE WHEN m.enabled THEN '' ELSE ' (disabled)' END,'spark' FROM m RETURNING id) SELECT json_build_object('model',(SELECT row_to_json(m) FROM m)) AS d";
  params=[mid,(p.enabled===true||p.enabled===false)?p.enabled:null,tier,str(p.modelId,80),str(p.label,40),str(p.description,200),actor.name];break;
 case "agents.set_model":
  var ag=str(p.agentId,40),dm=str(p.model,40);if(AGENT_IDS.indexOf(ag)<0||!dm)return deny("INVALID_REQUEST","agentId and model are required.",action);
  sql="WITH s AS (INSERT INTO ys_agent_settings (agent_id,default_model,enabled,updated_by,updated_at) VALUES ($1,$2,coalesce($4::boolean,true),$3,now()) ON CONFLICT (agent_id) DO UPDATE SET default_model=EXCLUDED.default_model, enabled=coalesce($4::boolean,ys_agent_settings.enabled), updated_by=EXCLUDED.updated_by, updated_at=now() RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) VALUES ($3,'user','changed the default model of','agent',$1,$1,$2,'spark') RETURNING id) SELECT json_build_object('setting',(SELECT row_to_json(s) FROM s)) AS d";
  params=[ag,dm,actor.name,(p.enabled===true||p.enabled===false)?p.enabled:null];break;
 case "settings.update":
  var sk=str(p.key,40);if(!sk||typeof p.value!=="object"||p.value===null)return deny("INVALID_REQUEST","key and an object value are required.",action);
  sql="WITH s AS (INSERT INTO ys_settings (key,value,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=ys_settings.value||EXCLUDED.value, updated_at=now() RETURNING *), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,icon) VALUES ($3,'user','updated settings','settings',$1,$1,'cog') RETURNING id) SELECT json_build_object('setting',(SELECT row_to_json(s) FROM s)) AS d";
  params=[sk,JSON.stringify(p.value),actor.name];break;
 case "agents.runs":
  sql="SELECT id,agent_id,owner_id,owner_kind,provider,model,conversation_id,status,error,duration_ms,at FROM ys_agent_runs ORDER BY at DESC LIMIT $1";params=[Math.min(num(p.limit,50),200)];meta.list=true;break;
 default:
  return deny("UNKNOWN_ACTION","Unknown action: "+action,action);
}
return [{json:{denied:false,action:action,requestId:rid,actor:actor,sql:sql,params:params,meta:meta}}];
