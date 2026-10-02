// ---- My Plan (ypl): one calendar for meals, workouts, study and events ------------------------------------------------
// Items live in ys_plan_items and are read and written through POST /svc/plan (workflow "Y Square - My Plan", same
// session check as Y Square Services). Repeating items are stored once and expanded here in the browser; the
// "Y Square - My Plan Reminders" workflow puts reminders in the notification bell and sends a 7am email (never to
// under-13 accounts). Group events the person is going to show up too. People can add things by typing or saying a
// sentence, with a form, or from an Athlete Edge / StudyPals answer ("Add to My Plan"); the AI's reading is always
// shown for approval before anything is saved. Each item has an "Add to Google Calendar" link, and Settings gives a
// private calendar link that Google Calendar or Apple Calendar can subscribe to, so the phone reminds them too.
ICONS.gear=ICONS.gear||ICONS.cog;
NT_KIND.plan_reminder=["cal","ac"];
var YPL_KINDS=[["meal","Meal","#16a34a"],["workout","Workout","#ea580c"],["study","Study","#2563eb"],["event","Event","#7c3aed"],["task","Task","#0891b2"],["other","Other","#64748b"]];
var YPL_FILTERS=[["all","All"],["meal","Meals"],["workout","Workouts"],["study","Study"],["event","Events"],["other","Other"]];
var YPL_DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var YPL_REMIND=[["","No reminder"],["0","At the start"],["5","5 minutes before"],["10","10 minutes before"],["15","15 minutes before"],["30","30 minutes before"],["60","1 hour before"],["120","2 hours before"],["1440","1 day before"]];
function yplKind(k){for(var i=0;i<YPL_KINDS.length;i++)if(YPL_KINDS[i][0]===k)return YPL_KINDS[i];return YPL_KINDS[5];}
function yplState(){if(!S.ypl)S.ypl={items:null,prefs:null,loading:false,err:null,at:0,view:(innerWidth>900?"week":"agenda"),filter:"all",week:null};return S.ypl;}
(function(){var st=document.createElement("style");st.id="yplcss";st.textContent=
 ".ypl-top{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}"+
 ".ypl-top h2{font-size:22px;letter-spacing:-.4px;margin:0}.ypl-top p{margin:4px 0 0;color:var(--tx2);font-size:13.5px}"+
 ".ypl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}"+
 ".ypl-seg{display:inline-flex;border:1px solid var(--line2);border-radius:10px;overflow:hidden}.ypl-seg button{border:0;background:var(--panel);padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;color:var(--tx2)}.ypl-seg button.on{background:var(--acs);color:var(--ac);font-weight:600}"+
 ".ypl-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.ypl-chips button{border:1px solid var(--line2);background:var(--panel);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--tx2)}.ypl-chips button.on{border-color:var(--ac);background:var(--acs);color:var(--ac);font-weight:600}"+
 ".ypl-day{margin-bottom:16px}.ypl-day h4{margin:0 0 8px;font-size:13px;letter-spacing:.2px;color:var(--tx2);text-transform:uppercase}.ypl-day h4 b{color:var(--tx)}"+
 ".ypl-row{display:grid;grid-template-columns:78px 4px 1fr;gap:12px;align-items:start;padding:11px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:8px;cursor:pointer;text-align:left;width:100%;font:inherit;color:inherit}"+
 ".ypl-row:hover{border-color:var(--line2);box-shadow:0 2px 10px rgba(15,23,42,.06)}.ypl-row.past{opacity:.6}"+
 ".ypl-t{font-size:13px;color:var(--tx2);white-space:nowrap;padding-top:1px}.ypl-bar4{width:4px;align-self:stretch;border-radius:4px}"+
 ".ypl-ti{font-weight:600;font-size:14.5px}.ypl-mt{font-size:12px;color:var(--tx3);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}.ypl-mt b{font-weight:600}.ypl-mt span{display:inline-flex;align-items:center;gap:4px}.ypl-mt svg{width:13px;height:13px;flex:none}"+
 ".ypl-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}"+
 ".ypl-col{border:1px solid var(--line);border-radius:12px;background:var(--panel);min-height:180px;padding:8px;display:flex;flex-direction:column;gap:6px}"+
 ".ypl-col.today{border-color:var(--ac);box-shadow:0 0 0 2px var(--acs)}.ypl-col h5{margin:0 0 2px;font-size:12px;color:var(--tx2);text-align:center}.ypl-col h5 b{display:block;font-size:17px;color:var(--tx)}"+
 ".ypl-ev{border:0;border-left:3px solid;border-radius:6px;background:var(--muts);padding:5px 7px;text-align:left;font:inherit;font-size:12px;cursor:pointer;color:inherit;width:100%}.ypl-ev b{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
 ".ypl-empty{text-align:center;padding:30px 16px;color:var(--tx2)}.ypl-empty b{display:block;color:var(--tx);font-size:16px;margin:8px 0 4px}"+
 ".ypl-tabs{display:flex;gap:6px;margin:4px 0 14px}.ypl-days{display:flex;gap:5px;flex-wrap:wrap}.ypl-days label{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line2);border-radius:999px;padding:4px 10px;font-size:12.5px;cursor:pointer}"+
 ".ypl-rev{display:grid;gap:8px;max-height:46vh;overflow:auto;margin:6px 0 12px}.ypl-rev label{display:grid;grid-template-columns:auto 4px 1fr;gap:10px;align-items:start;border:1px solid var(--line);border-radius:10px;padding:9px 11px;cursor:pointer}.ypl-rev input{margin-top:3px}"+
 ".ypl-link{display:flex;gap:6px;align-items:center}.ypl-link input{flex:1;min-width:0;font-size:12.5px;padding:8px 10px;border:1px solid var(--line2);border-radius:9px;background:var(--panel2)}"+
 ".ypl-set h4{margin:14px 0 6px;font-size:14px;display:flex;align-items:center;gap:7px}.ypl-set p{margin:0 0 8px;color:var(--tx2);font-size:13px}.ypl-set ol{margin:6px 0 10px 18px;padding:0;color:var(--tx2);font-size:13px;display:grid;gap:3px}"+
 ".ypl-today{margin-bottom:18px}.ypl-today .bd{display:grid;gap:8px}.ypl-today .ypl-row{margin:0}"+
 ".yplAdd{margin-left:8px}"+
 "@media (max-width:900px){.ypl-week{grid-template-columns:repeat(7,minmax(120px,1fr));overflow-x:auto;padding-bottom:6px}}"+
 "@media (max-width:640px){.ypl-row{grid-template-columns:62px 4px 1fr;gap:10px;padding:10px 12px}}";
 document.head.appendChild(st);})();
// ---- data ----
function yplApi(action,payload){
 return fetch(BASE+"/svc/plan",{method:"POST",headers:headers(),body:JSON.stringify({action:action,payload:payload||{}})})
  .then(function(r){return r.json().catch(function(){return {success:false,error:{code:"BAD_RESPONSE",message:"The server returned an unexpected response ("+r.status+")."}};});})
  .then(function(j){
   if(j&&j.success)return j.data;
   var e=(j&&j.error)||{code:"ERROR",message:"Request failed."};
   if(e.code==="INVALID_SESSION"&&S.token){clearSession();wipeLocal();toast("Your session ended. Please sign in again.","err");setTimeout(function(){boot();},0);}
   throw e;
  },function(){throw {code:"NETWORK",message:"We could not connect. Check your internet connection and try again."};});
}
function yplLoad(force){
 var st=yplState();if(!signedIn()||st.loading)return;
 if(!force&&st.items&&Date.now()-st.at<60000)return;
 st.loading=true;
 yplApi("plan.list").then(function(d){st.items=d.items||[];st.prefs=d.prefs||{digest:true,feedToken:null};st.err=null;})
  .catch(function(e){st.err=e;if(!st.items)st.items=null;})
  .then(function(){st.loading=false;st.at=Date.now();var v=(S.route||{}).view;if(v==="plan"||v==="home"||!v)render();});
}
function yplTz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch(e){return "UTC";}}
function yplYmd(d){var p=function(n){return (n<10?"0":"")+n;};return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());}
function yplHm(d){var p=function(n){return (n<10?"0":"")+n;};return p(d.getHours())+":"+p(d.getMinutes());}
function yplDay0(d){var x=new Date(d);x.setHours(0,0,0,0);return x;}
function yplTime(d){return d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});}
function yplDayName(d){var t=yplDay0(new Date()),x=yplDay0(d),n=Math.round((x-t)/864e5);return n===0?"Today":n===1?"Tomorrow":n===-1?"Yesterday":d.toLocaleDateString([],{weekday:"long"});}
function yplLocal(date,hm){var a=String(date||"").split("-"),b=String(hm||"00:00").split(":");return new Date(+a[0],+a[1]-1,+a[2],+b[0]||0,+b[1]||0);}
function yplRepeatText(it){
 if(!it.repeat)return "";
 var t=it.repeat==="daily"?"Every day":it.repeat==="weekdays"?"Weekdays":"Every "+((it.repeat_days&&it.repeat_days.length?it.repeat_days:[new Date(it.starts_at).getDay()]).map(function(d){return YPL_DOW[d];}).join(", "));
 return t+(it.repeat_until?" until "+new Date(it.repeat_until+"T12:00:00").toLocaleDateString([],{month:"short",day:"numeric"}):"");
}
// Every occurrence between from and to (repeating items expanded), plus group events the person is going to.
function yplOcc(from,to){
 var st=yplState(),out=[];
 (st.items||[]).forEach(function(it){
  var s=new Date(it.starts_at),dur=it.ends_at?(new Date(it.ends_at)-s):0;
  if(!it.repeat){if(s>=from&&s<to)out.push({it:it,at:s,end:dur?new Date(+s+dur):null});return;}
  var until=it.repeat_until?new Date(it.repeat_until+"T23:59:59"):null;
  var d=yplDay0(new Date(Math.max(+from,+yplDay0(s))));
  for(var guard=0;d<to&&guard<400;guard++,d.setDate(d.getDate()+1)){
   if(until&&d>until)break;
   var dow=d.getDay(),days=it.repeat_days&&it.repeat_days.length?it.repeat_days:[s.getDay()];
   if(!(it.repeat==="daily"||(it.repeat==="weekdays"&&dow>=1&&dow<=5)||(it.repeat==="weekly"&&days.indexOf(dow)>=0)))continue;
   var at=new Date(d.getFullYear(),d.getMonth(),d.getDate(),s.getHours(),s.getMinutes());
   if(at<yplDay0(s)||at<from||at>=to)continue;
   out.push({it:it,at:at,end:dur?new Date(+at+dur):null});
  }
 });
 ((S.boot||{}).events||[]).forEach(function(e){
  if(!e.starts_at||!(e.my_rsvp==="yes"||e.is_owner))return;
  var at=new Date(e.starts_at);if(at>=from&&at<to)out.push({ev:e,at:at,end:e.ends_at?new Date(e.ends_at):null});
 });
 var f=yplState().filter;
 if(f!=="all")out=out.filter(function(o){var k=o.ev?"event":o.it.kind;return f==="other"?(k==="other"||k==="task"):k===f;});
 return out.sort(function(a,b){return a.at-b.at;});
}
// ---- pieces ----
function yplRow(o,i){
 var k=o.ev?yplKind("event"):yplKind(o.it.kind),title=o.ev?o.ev.title:o.it.title;
 var t=o.it&&o.it.all_day?"All day":yplTime(o.at);
 var meta='<span style="color:'+k[2]+'"><b>'+esc(k[1])+'</b></span>'+(o.end&&!(o.it&&o.it.all_day)?'<span>until '+esc(yplTime(o.end))+'</span>':"")+(o.it&&o.it.repeat?'<span>'+ic("refresh")+' '+esc(yplRepeatText(o.it))+'</span>':"")+(o.ev&&o.ev.venue?'<span>'+ic("map")+' '+esc(o.ev.venue)+'</span>':"")+(o.it&&o.it.notes?'<span>'+esc(o.it.notes)+'</span>':"");
 var click=o.ev?'A.go(\'#/events/'+attr(o.ev.id)+'\')':'A.yplOpen(\''+attr(o.it.id)+'\')';
 return '<button type="button" class="ypl-row'+(o.at<new Date()&&!(o.it&&o.it.all_day)?' past':'')+'" onclick="'+click+'"><span class="ypl-t">'+esc(t)+'</span><span class="ypl-bar4" style="background:'+k[2]+'"></span><span><span class="ypl-ti">'+esc(title)+'</span><span class="ypl-mt">'+meta+'</span></span></button>';
}
function yplAgenda(){
 var from=yplDay0(new Date()),to=new Date(+from+14*864e5),occ=yplOcc(from,to),by={},order=[];
 occ.forEach(function(o){var k=yplYmd(o.at);if(!by[k]){by[k]=[];order.push(k);}by[k].push(o);});
 if(!order.length)return yplEmpty();
 return order.map(function(k){var d=by[k][0].at;return '<div class="ypl-day"><h4><b>'+esc(yplDayName(d))+'</b> &middot; '+esc(d.toLocaleDateString([],{month:"short",day:"numeric"}))+'</h4>'+by[k].map(yplRow).join("")+'</div>';}).join("");
}
function yplWeekStart(){var st=yplState();if(!st.week){var d=yplDay0(new Date());d.setDate(d.getDate()-((d.getDay()+6)%7));st.week=d;}return st.week;}
function yplWeek(){
 var ws=yplWeekStart(),we=new Date(+ws+7*864e5),occ=yplOcc(ws,we),today=yplYmd(new Date()),cols="";
 for(var i=0;i<7;i++){
  var d=new Date(ws);d.setDate(ws.getDate()+i);var k=yplYmd(d);
  var list=occ.filter(function(o){return yplYmd(o.at)===k;});
  cols+='<div class="ypl-col'+(k===today?' today':'')+'"><h5>'+esc(YPL_DOW[d.getDay()])+'<b>'+d.getDate()+'</b></h5>'+list.map(function(o){var kd=o.ev?yplKind("event"):yplKind(o.it.kind);var click=o.ev?'A.go(\'#/events/'+attr(o.ev.id)+'\')':'A.yplOpen(\''+attr(o.it.id)+'\')';return '<button type="button" class="ypl-ev" style="border-left-color:'+kd[2]+'" onclick="'+click+'"><b>'+esc(o.ev?o.ev.title:o.it.title)+'</b>'+esc(o.it&&o.it.all_day?"All day":yplTime(o.at))+'</button>';}).join("")+'</div>';
 }
 var label=ws.toLocaleDateString([],{month:"short",day:"numeric"})+" - "+new Date(+we-864e5).toLocaleDateString([],{month:"short",day:"numeric"});
 return '<div class="row" style="gap:8px;margin-bottom:10px;align-items:center"><button class="btn s" onclick="A.yplWeek(-1)" aria-label="Previous week">&lsaquo;</button><button class="btn s" onclick="A.yplWeek(0)">This week</button><button class="btn s" onclick="A.yplWeek(1)" aria-label="Next week">&rsaquo;</button><b style="margin-left:6px">'+esc(label)+'</b></div><div class="ypl-week">'+cols+'</div>';
}
function yplEmpty(){
 return '<div class="card"><div class="ypl-empty"><div style="width:52px;height:52px;border-radius:16px;background:var(--acs);color:var(--ac);display:grid;place-items:center;margin:0 auto">'+ic("cal","ic22")+'</div><b>Nothing planned yet</b><div class="small">Add a meal, a workout or a study session - or say it in a sentence, like "Gym Monday, Wednesday and Friday at 5pm".</div><div style="margin-top:12px"><button class="btn p" onclick="A.yplAdd()">'+ic("plus")+'Add to My Plan</button></div></div></div>';
}
function vPlan(){
 if(!signedIn())return '<div class="card"><div class="ypl-empty"><div style="width:52px;height:52px;border-radius:16px;background:var(--acs);color:var(--ac);display:grid;place-items:center;margin:0 auto">'+ic("cal","ic22")+'</div><b>Your meals, workouts and study in one place</b><div class="small" style="max-width:460px;margin:0 auto">My Plan keeps your food plan, gym plan, study plan and events together, and reminds you before each one. Sign in with the button at the top right to start.</div></div></div>';
 var st=yplState();yplLoad(false);
 var top='<div class="ypl-top"><div><h2>My Plan</h2><p>Meals, workouts, study and events - with reminders.</p></div><div class="ypl-bar"><div class="ypl-seg" role="group" aria-label="View"><button class="'+(st.view==="agenda"?"on":"")+'" onclick="A.yplView(\'agenda\')">List</button><button class="'+(st.view==="week"?"on":"")+'" onclick="A.yplView(\'week\')">Week</button></div><button class="btn" onclick="A.yplSettings()">'+ic("cog")+'Settings</button><button class="btn p" onclick="A.yplAdd()">'+ic("plus")+'Add</button></div></div>';
 var chips='<div class="ypl-chips">'+YPL_FILTERS.map(function(f){return '<button class="'+(st.filter===f[0]?"on":"")+'" onclick="A.yplFilter(\''+f[0]+'\')">'+esc(f[1])+'</button>';}).join("")+'</div>';
 if(!st.items&&st.loading)return top+loadingHtml("Loading your plan","One moment...");
 if(!st.items&&st.err)return top+'<div class="card"><div class="bd small">Could not load your plan: '+esc(st.err.message||"")+' <a href="#" onclick="A.yplReload();return false">Try again</a></div></div>';
 if(!st.items)return top+loadingHtml("Loading your plan","One moment...");
 if(!st.items.length&&!yplOcc(yplDay0(new Date()),new Date(Date.now()+30*864e5)).length)return top+yplEmpty();
 return top+chips+(st.view==="week"?yplWeek():yplAgenda());
}
// Home: what is on today, for signed-in members.
function yplTodayCard(){
 if(!signedIn())return "";
 var st=yplState();yplLoad(false);
 var from=yplDay0(new Date()),to=new Date(+from+864e5),f=st.filter;st.filter="all";var occ=st.items?yplOcc(from,to):[];st.filter=f;
 var now=new Date(),next=occ.filter(function(o){return (o.end||o.at)>=now||(o.it&&o.it.all_day);}).slice(0,4);
 var body=!st.items?'<div class="small muted">Loading your plan...</div>':next.length?next.map(yplRow).join(""):'<div class="small muted">'+(occ.length?"That's everything for today - nice work.":"Nothing planned for today. Add a meal, a workout or a study session.")+'</div>';
 return '<div class="card ypl-today"><div class="hd">'+ic("cal")+'<h3>Today</h3><div class="sp"></div><button class="btn xs ghost" onclick="A.yplAdd()">'+ic("plus")+'Add</button><a class="btn xs" href="#/plan">Open My Plan</a></div><div class="bd">'+body+'</div></div>';
}
// ---- add / edit ----
function yplFormHtml(it){
 it=it||{};var s=it.starts_at?new Date(it.starts_at):new Date(Date.now()+36e5);if(!it.starts_at){s.setMinutes(0,0,0);}
 var e=it.ends_at?new Date(it.ends_at):null,rep=it.repeat||"",days=it.repeat_days||[s.getDay()];
 var rem=it.id?(it.remind_min===null||it.remind_min===undefined?"":String(it.remind_min)):"15";
 function opt(v,l,c){return '<option value="'+attr(v)+'"'+(v===c?" selected":"")+'>'+esc(l)+'</option>';}
 return '<form id="ypl-form" onsubmit="return A.yplSave(this)">'+(it.id?'<input type="hidden" name="id" value="'+attr(it.id)+'">':'')+
  '<div class="f"><label for="ypl-title">What *</label><input id="ypl-title" name="title" maxlength="120" required value="'+attr(it.title||"")+'" placeholder="Gym - legs, Breakfast, Maths revision..."></div>'+
  '<div class="grid2"><div class="f"><label for="ypl-kind">Type</label><select id="ypl-kind" name="kind">'+YPL_KINDS.map(function(k){return opt(k[0],k[1],it.kind||"other");}).join("")+'</select></div>'+
  '<div class="f"><label for="ypl-date">Date *</label><input id="ypl-date" name="date" type="date" required value="'+attr(yplYmd(s))+'"></div></div>'+
  '<div class="grid2"><div class="f"><label for="ypl-start">Starts</label><input id="ypl-start" name="start" type="time" value="'+attr(it.all_day?"":yplHm(s))+'"></div>'+
  '<div class="f"><label for="ypl-end">Ends</label><input id="ypl-end" name="end" type="time" value="'+attr(e&&!it.all_day?yplHm(e):"")+'"></div></div>'+
  '<label class="small" style="display:flex;gap:8px;align-items:center;margin:-4px 0 12px"><input type="checkbox" name="allDay"'+(it.all_day?" checked":"")+' style="width:auto"> All day</label>'+
  '<div class="grid2"><div class="f"><label for="ypl-rep">Repeat</label><select id="ypl-rep" name="repeat" onchange="A.yplRep(this.value)">'+opt("","Does not repeat",rep)+opt("daily","Every day",rep)+opt("weekdays","Weekdays (Mon-Fri)",rep)+opt("weekly","Weekly on...",rep)+'</select></div>'+
  '<div class="f" id="ypl-until-f" style="'+(rep?"":"display:none")+'"><label for="ypl-until">Until (optional)</label><input id="ypl-until" name="until" type="date" value="'+attr(it.repeat_until||"")+'"></div></div>'+
  '<div class="f" id="ypl-days-f" style="'+(rep==="weekly"?"":"display:none")+'"><label>On these days</label><div class="ypl-days">'+YPL_DOW.map(function(n,i){return '<label><input type="checkbox" name="d'+i+'"'+(days.indexOf(i)>=0?" checked":"")+' style="width:auto">'+n+'</label>';}).join("")+'</div></div>'+
  '<div class="f"><label for="ypl-rem">Reminder</label><select id="ypl-rem" name="remind">'+YPL_REMIND.map(function(r){return opt(r[0],r[1],rem);}).join("")+'</select><span class="help">You get it in the bell here, and on your phone if you add your calendar link (Settings).</span></div>'+
  '<div class="f"><label for="ypl-notes">Notes</label><textarea id="ypl-notes" name="notes" maxlength="500" placeholder="Details, e.g. 3 sets of squats, chapter 4...">'+esc(it.notes||"")+'</textarea></div>'+
  '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn p" type="submit">'+ic("check")+(it.id?"Save changes":"Add to My Plan")+'</button>'+
  (it.id?'<a class="btn" href="'+attr(yplGcalUrl(it))+'" target="_blank" rel="noopener noreferrer">'+ic("link")+'Add to Google Calendar</a><div class="sp" style="flex:1"></div><button class="btn ghost" type="button" style="color:var(--err)" onclick="A.yplDelete(\''+attr(it.id)+'\')">'+ic("x")+'Delete</button>':'')+'</div></form>';
}
function yplModal(inner,title){openModal('<div class="row between"><h2>'+esc(title)+'</h2><button class="btn icon ghost" onclick="A.closeModal()" aria-label="Close">'+ic("x")+'</button></div>'+inner);}
function yplDescribeHtml(text,err,question){
 var mic=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
 return '<div class="ypl-tabs"><button class="btn s p">'+ic("spark")+'Describe it</button><button class="btn s" onclick="A.yplForm()">'+ic("plus")+'Use a form</button></div>'+
  '<div class="f"><label for="ypl-say">Say or type what to add</label><textarea id="ypl-say" maxlength="2000" style="min-height:90px" placeholder="e.g. Gym Monday, Wednesday and Friday at 5pm. Study chemistry every weekday at 7pm until Oct 20.">'+esc(text||"")+'</textarea></div>'+
  (question?'<div class="small" style="margin:-4px 0 10px;color:var(--ac)" role="status">'+ic("help")+' '+esc(question)+'</div>':"")+
  (err?'<div class="small" style="margin:-4px 0 10px;color:var(--err)" role="alert">'+esc(err)+'</div>':"")+
  '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn p" id="ypl-read" onclick="A.yplRead()">'+ic("send")+'Read it</button>'+(mic?'<button class="btn" id="ypl-mic" onclick="A.yplMic()">'+ic("mic")+'Speak</button>':'')+'<span class="small muted">You will see everything before it is saved.</span></div>';
}
function yplReviewHtml(){
 var r=S.yplReview||{items:[]};
 return '<p class="small muted" style="margin:0 0 6px">Untick anything you do not want, then add the rest to My Plan.</p><div class="ypl-rev">'+r.items.map(function(x,i){var k=yplKind(x.kind);var when=new Date(x.date+"T12:00:00").toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})+(x.start?" "+yplTime(yplLocal(x.date,x.start)):" (all day)");var rep=x.repeat?yplRepeatText({repeat:x.repeat,repeat_days:x.days,repeat_until:x.until,starts_at:yplLocal(x.date,x.start).toISOString()}):"";return '<label><input type="checkbox"'+(x.on!==false?" checked":"")+' onchange="A.yplTick('+i+',this.checked)"><span class="ypl-bar4" style="background:'+k[2]+'"></span><span><b>'+esc(x.title)+'</b><span class="ypl-mt"><span style="color:'+k[2]+'"><b>'+esc(k[1])+'</b></span><span>'+esc(when)+'</span>'+(rep?'<span>'+ic("refresh")+' '+esc(rep)+'</span>':"")+(x.notes?'<span>'+esc(x.notes)+'</span>':"")+'</span></span></label>';}).join("")+'</div>'+
  '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn p" id="ypl-saveall" onclick="A.yplSaveAll()">'+ic("check")+'Add to My Plan</button><button class="btn" onclick="A.yplAdd()">Start over</button></div>';
}
function yplToItem(x,source){
 var s=yplLocal(x.date,x.start||"00:00"),e=x.start&&x.end?yplLocal(x.date,x.end):null;if(e&&e<=s)e=null;
 return {title:x.title,kind:x.kind,notes:x.notes||null,startsAt:s.toISOString(),endsAt:e?e.toISOString():null,allDay:!x.start,tz:yplTz(),repeat:x.repeat||null,repeatDays:x.days||null,repeatUntil:x.until||null,remindMin:!x.start?null:(x.kind==="meal"?10:15),source:source||"sentence"};
}
function yplGcalUrl(it){
 var p=function(n){return (n<10?"0":"")+n;};
 function loc(d){return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"T"+p(d.getHours())+p(d.getMinutes())+"00";}
 var s=new Date(it.starts_at),e=it.ends_at?new Date(it.ends_at):new Date(+s+30*6e4),dates;
 if(it.all_day){var n=new Date(s);n.setDate(n.getDate()+1);dates=yplYmd(s).replace(/-/g,"")+"/"+yplYmd(n).replace(/-/g,"");}else dates=loc(s)+"/"+loc(e);
 var q="action=TEMPLATE&text="+encodeURIComponent(it.title)+"&dates="+dates+"&ctz="+encodeURIComponent(it.tz||yplTz())+(it.notes?"&details="+encodeURIComponent(it.notes):"");
 if(it.repeat){var D=["SU","MO","TU","WE","TH","FR","SA"];var rule=it.repeat==="daily"?"FREQ=DAILY":it.repeat==="weekdays"?"FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR":"FREQ=WEEKLY;BYDAY="+((it.repeat_days&&it.repeat_days.length?it.repeat_days:[s.getDay()]).map(function(d){return D[d];}).join(","));if(it.repeat_until)rule+=";UNTIL="+it.repeat_until.replace(/-/g,"")+"T235959Z";q+="&recur="+encodeURIComponent("RRULE:"+rule);}
 return "https://calendar.google.com/calendar/render?"+q;
}
function yplFeedUrl(tok){return BASE+"/svc/calendar?k="+tok;}
function yplSettingsHtml(){
 var st=yplState(),p=st.prefs||{},tok=p.feedToken,url=tok?yplFeedUrl(tok):"";
 var webcal=url.replace(/^https?:/,"webcal:");
 return '<div class="ypl-set"><h4>'+ic("cal")+' Put My Plan in your phone\'s calendar</h4><p>Your phone then reminds you, even when Y Square is closed. Keep this link private - anyone who has it can see your plan.</p>'+
  (tok?'<div class="ypl-link"><input readonly value="'+attr(url)+'" aria-label="Your calendar link" onclick="this.select()"><button class="btn s" onclick="A.copyText(this)" data-text="'+attr(url)+'">'+ic("copy")+'Copy</button></div>'+
   '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><a class="btn s p" href="https://calendar.google.com/calendar/r?cid='+attr(encodeURIComponent(webcal))+'" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a><a class="btn s" href="'+attr(webcal)+'">Add to Apple Calendar</a></div>'+
   '<ol><li><b>Google Calendar</b> (on a computer): Other calendars, +, From URL, paste the link. Google can take a few hours to show changes.</li><li><b>iPhone</b>: tap Add to Apple Calendar, or Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar.</li></ol>'+
   '<button class="btn xs ghost" onclick="A.yplFeed(true)">Make a new link (the old one stops working)</button>'
  :'<button class="btn p" onclick="A.yplFeed(false)">'+ic("link")+'Get my calendar link</button>')+
  '<h4>'+ic("mail")+' Morning email</h4><p>A short "Your plan today" email at 7am on days you have something planned. Not sent to accounts under 13.</p>'+
  '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" style="width:auto"'+(p.digest!==false?" checked":"")+' onchange="A.yplDigest(this.checked)"> Send me the morning email</label>'+
  '<h4>'+ic("bell")+' Reminders here</h4><p>Reminders also appear in the bell at the top of Y Square while you have it open.</p></div>';
}
// ---- actions ----
A.yplReload=function(){yplLoad(true);render();};
A.yplView=function(v){yplState().view=v;render();};
A.yplFilter=function(f){yplState().filter=f;render();};
A.yplWeek=function(n){var st=yplState();if(n===0)st.week=null;else{yplWeekStart();st.week=new Date(+st.week+n*7*864e5);}render();};
A.yplAdd=function(){if(!signedIn()){toast("Sign in with the button at the top right to use My Plan.");return;}S.yplReview=null;yplModal(yplDescribeHtml(),"Add to My Plan");setTimeout(function(){var t=document.getElementById("ypl-say");if(t)t.focus();},50);};
A.yplForm=function(){yplModal(yplFormHtml(null),"Add to My Plan");};
A.yplOpen=function(id){var it=(yplState().items||[]).filter(function(x){return x.id===id;})[0];if(!it)return;yplModal(yplFormHtml(it),"Edit");};
A.yplRep=function(v){var d=document.getElementById("ypl-days-f"),u=document.getElementById("ypl-until-f");if(d)d.style.display=v==="weekly"?"":"none";if(u)u.style.display=v?"":"none";};
A.yplSave=function(f){
 var g=function(n){return String((f.elements[n]||{}).value||"").trim();};
 var allDay=!!(f.elements.allDay&&f.elements.allDay.checked)||!g("start");
 if(!g("title")||!g("date")){toast("Please add a title and a date.","err");return false;}
 var s=yplLocal(g("date"),allDay?"00:00":g("start")),e=!allDay&&g("end")?yplLocal(g("date"),g("end")):null;if(e&&e<=s)e=null;
 var days=[];for(var i=0;i<7;i++)if(f.elements["d"+i]&&f.elements["d"+i].checked)days.push(i);
 var item={id:g("id")||undefined,title:g("title"),kind:g("kind"),notes:g("notes")||null,startsAt:s.toISOString(),endsAt:e?e.toISOString():null,allDay:allDay,tz:yplTz(),repeat:g("repeat")||null,repeatDays:g("repeat")==="weekly"?(days.length?days:[s.getDay()]):null,repeatUntil:g("repeat")&&g("until")?g("until"):null,remindMin:g("remind")===""?null:Number(g("remind")),source:"manual"};
 var b=f.querySelector('button[type=submit]');if(b)b.disabled=true;
 yplApi("plan.save",{item:item}).then(function(){closeModal();toast(item.id?"Saved":"Added to My Plan","ok");yplLoad(true);}).catch(function(err){if(b)b.disabled=false;toast(err.message||"Could not save.","err");});
 return false;
};
A.yplDelete=function(id){
 if(!confirm("Delete this from My Plan? If it repeats, every day of it is removed."))return;
 yplApi("plan.delete",{id:id}).then(function(){closeModal();toast("Deleted","ok");yplLoad(true);}).catch(function(e){toast(e.message||"Could not delete.","err");});
};
function yplParse(text,source,btn,onErr){
 var now=new Date();
 if(btn){btn.disabled=true;btn.innerHTML='<span class="typing"><i></i><i></i><i></i></span> Reading...';}
 return yplApi("plan.parse",{text:text,source:source,today:yplYmd(now),weekday:now.toLocaleDateString("en-US",{weekday:"long"}),tz:yplTz()}).then(function(d){
  if(d.question&&!(d.items||[]).length){onErr(null,d.question);return;}
  S.yplReview={items:(d.items||[]).map(function(x){x.on=true;return x;}),source:source};
  yplModal(yplReviewHtml(),"Check before adding");
 }).catch(function(e){onErr(e.message||"Could not read that. Please try again.");});
}
A.yplRead=function(){
 var t=document.getElementById("ypl-say"),text=t?t.value.trim():"";
 if(text.length<3){toast("Type or say what to add first.","err");return;}
 yplParse(text,"sentence",document.getElementById("ypl-read"),function(err,q){yplModal(yplDescribeHtml(text,err,q),"Add to My Plan");});
};
A.yplMic=function(){
 var R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return;
 var b=document.getElementById("ypl-mic"),t=document.getElementById("ypl-say");
 if(S.yplRec){try{S.yplRec.stop();}catch(e){}return;}
 var r=new R();r.lang=navigator.language||"en-US";r.interimResults=false;r.continuous=false;S.yplRec=r;
 if(b)b.innerHTML=ic("mic")+"Listening... tap to stop";
 r.onresult=function(ev){var s="";for(var i=0;i<ev.results.length;i++)s+=ev.results[i][0].transcript;if(t)t.value=(t.value?t.value+" ":"")+s;};
 r.onend=r.onerror=function(){S.yplRec=null;if(b)b.innerHTML=ic("mic")+"Speak";};
 try{r.start();}catch(e){S.yplRec=null;}
};
A.yplTick=function(i,on){if(S.yplReview&&S.yplReview.items[i])S.yplReview.items[i].on=on;};
A.yplSaveAll=function(){
 var r=S.yplReview;if(!r)return;var list=r.items.filter(function(x){return x.on!==false;});
 if(!list.length){toast("Nothing ticked.","err");return;}
 var b=document.getElementById("ypl-saveall");if(b)b.disabled=true;
 yplApi("plan.save_many",{items:list.slice(0,60).map(function(x){return yplToItem(x,r.source);})}).then(function(d){
  closeModal();S.yplReview=null;toast("Added "+d.saved+" to My Plan","ok");yplLoad(true);if((S.route||{}).view!=="plan")setTimeout(function(){toast("Open My Plan from the menu to see it.");},900);
 }).catch(function(e){if(b)b.disabled=false;toast(e.message||"Could not save.","err");});
};
A.yplSettings=function(){yplModal(yplSettingsHtml(),"My Plan settings");};
A.yplFeed=function(reset){
 if(reset&&!confirm("Make a new calendar link? Calendars using the old link stop updating until you add the new one."))return;
 yplApi("plan.feed",{reset:!!reset}).then(function(d){var st=yplState();st.prefs=st.prefs||{digest:true};st.prefs.feedToken=d.feedToken;A.yplSettings();}).catch(function(e){toast(e.message||"Could not make the link.","err");});
};
A.yplDigest=function(on){yplApi("plan.prefs",{digest:!!on,tz:yplTz()}).then(function(d){var st=yplState();st.prefs=st.prefs||{};st.prefs.digest=d.digest;toast(d.digest?"Morning email on":"Morning email off","ok");}).catch(function(e){toast(e.message||"Could not save.","err");});};
// "Add to My Plan" under Athlete Edge and StudyPals answers: the answer's text goes to the planner, which lists the
// meals / workouts / study sessions it found for the person to check.
A.yplFromMsg=function(btn,source){
 if(!signedIn()){toast("Sign in with the button at the top right to use My Plan.");return;}
 var m=btn.closest(".msg"),bub=m&&m.querySelector(".bub");if(!bub)return;
 var text=(bub.innerText||bub.textContent||"").trim().slice(0,6000),label=btn.innerHTML;
 yplParse(text,source,btn,function(err,q){btn.disabled=false;btn.innerHTML=label;toast(err||q||"Nothing to add from this answer.","err");}).then(function(){btn.disabled=false;btn.innerHTML=label;});
};
function yplMsgButtons(){
 [["agent-athlete","athlete"],["agent-studypals","studypals"]].forEach(function(p){
  var box=document.getElementById("msgs-"+p[0]);if(!box)return;
  box.querySelectorAll(".msg:not(.me)").forEach(function(m){
   if(m.querySelector(".yplAdd,.typing"))return;
   var bub=m.querySelector(".bub"),meta=m.querySelector(".meta");
   if(!bub||!meta||(bub.textContent||"").trim().length<120)return;
   meta.insertAdjacentHTML("beforeend",'<button type="button" class="btn xs ghost yplAdd" onclick="A.yplFromMsg(this,\''+p[1]+'\')">'+ic("cal")+'Add to My Plan</button>');
  });
 });
}
(function(){var app=document.getElementById("app");if(!app||!window.MutationObserver)return;var q=false;new MutationObserver(function(){if(q)return;q=true;setTimeout(function(){q=false;try{yplMsgButtons();}catch(e){}},0);}).observe(app,{childList:true,subtree:true});})();
// ---- menu, phone tab bar, home and route ----
var yplBaseSidebar=sidebar;
sidebar=function(){
 var h=yplBaseSidebar.apply(this,arguments),v=(S.route||{}).view;
 var i=h.indexOf('<a href="#/" class="'),j=i<0?-1:h.indexOf('</a>',i);
 if(j<0)return h;
 return h.slice(0,j+4)+'<a href="#/plan" class="'+(v==="plan"?"on":"")+'">'+ic("cal")+'My Plan</a>'+h.slice(j+4);
};
var yplBaseTabbar=tabbar;
tabbar=function(){
 var h=yplBaseTabbar.apply(this,arguments),v=(S.route||{}).view;
 h=h.replace(/<a href="#\/events" class="[^"]*">[\s\S]*?<\/a>/,'<a href="#/plan" class="'+(v==="plan"?"on":"")+'">'+ic("cal")+'<span>Plan</span></a>');
 if(v==="events")h=h.replace('<button type="button" class="" onclick="A.drawer(true)">','<button type="button" class="on" onclick="A.drawer(true)">');
 return h;
};
var yplBaseHome=vHome;
vHome=function(){return yplTodayCard()+yplBaseHome.apply(this,arguments);};
var yplBaseRender=render;
render=function(){
 var r=parseHash();
 if(r.view!=="plan"||(S.err&&!S.boot))return yplBaseRender.apply(this,arguments);
 S.route=r;var root=document.getElementById("app");
 root.innerHTML='<div class="shell">'+sidebar()+'<div class="main">'+header("My Plan")+'<div class="content"><div class="wrap">'+vPlan()+footerHtml()+'</div></div></div></div>'+tabbar()+'<div class="scrim" onclick="A.drawer(false)"></div>';
 renderModal();try{renderGoogleButtons();}catch(e){}
};
