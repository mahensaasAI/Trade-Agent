// ---- Events: Agent Planner on the page, AI Planner, and removing events (yev) ------------------------------------------
// - The Agent Planner no longer opens as a pop-up: it opens as a panel at the top of the Events page, with two tabs:
//   "Create an event" (the existing Agent Planner conversation - describe the event, it asks for what is missing and
//   creates it) and "AI Planner" (the Event Planner agent's chat for checklists, roles, budgets and announcements,
//   before an event exists; inside an event the AI Planner tab still sees its live tasks and RSVPs).
// - Organisers can delete their event from the event's Edit window (the event management section); admins can delete
//   any event from Admin > Events, which lists every event and flags the ones that look unused. Both go to
//   POST /svc/events-admin (workflow "Y Square - Event Admin"), which removes the event with its tasks, updates, chat
//   and members and tells the other members.
(function(){var st=document.createElement("style");st.id="yevcss";st.textContent=
 ".yev-panel{margin:0 0 16px;overflow:hidden}.yev-panel>.hd{flex-wrap:wrap;gap:8px;position:relative;padding-right:56px}.yev-panel>.hd>.btn.icon{position:absolute;right:12px;top:50%;transform:translateY(-50%)}"+
 ".yev-tabs{display:flex;gap:6px}.yev-tabs button{border:1px solid var(--line2);background:var(--panel);border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;cursor:pointer;color:var(--tx2);display:inline-flex;gap:6px;align-items:center}.yev-tabs button.on{border-color:var(--ac);background:var(--acs);color:var(--ac);font-weight:600}"+
 ".yev-panel .agp>.row.between:first-child{display:none}.yev-panel .agp-log{max-height:340px}"+
 ".yev-panel .ws{min-height:0}.yev-panel .chat{height:min(560px,70vh)}"+
 ".yev-danger{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}.yev-danger b{color:var(--err)}.yev-danger p{margin:4px 0 10px;color:var(--tx2);font-size:13px}"+
 ".btn.yev-del{color:var(--err);border-color:var(--err);background:transparent}.btn.yev-del:hover{background:var(--errs)}"+
 ".yev-adm .chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.yev-adm .chips button{border:1px solid var(--line2);background:var(--panel);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--tx2)}.yev-adm .chips button.on{border-color:var(--ac);background:var(--acs);color:var(--ac);font-weight:600}"+
 ".yev-row{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.3fr) minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 14px;border-top:1px solid var(--line)}.yev-row:first-child{border-top:0}"+
 ".yev-row .t b{display:block}.yev-row .m{font-size:12.5px;color:var(--tx2)}.yev-row .a{display:flex;gap:6px;justify-content:flex-end}"+
 "@media (max-width:760px){.yev-row{grid-template-columns:1fr}.yev-row .a{justify-content:flex-start}}";
 document.head.appendChild(st);})();
function yevApi(action,payload){
 return fetch(BASE+"/svc/events-admin",{method:"POST",headers:headers(),body:JSON.stringify({action:action,payload:payload||{}})})
  .then(function(r){return r.json().catch(function(){return {success:false,error:{code:"BAD_RESPONSE",message:"The server returned an unexpected response ("+r.status+")."}};});})
  .then(function(j){if(j&&j.success)return j.data;throw (j&&j.error)||{code:"ERROR",message:"Request failed."};},function(){throw {code:"NETWORK",message:"We could not connect. Check your internet connection and try again."};});
}
function yevS(){if(!S.yev)S.yev={open:false,tab:"create"};return S.yev;}
function yevNewAgp(){return {text:"",base:"",qa:[],turns:[],draft:null,missing:[],asks:{},busy:false,voice:false,link:"",conv:"agp-"+uid("").slice(0,12),focus:true};}
// The Agent Planner conversation, drawn inside the panel (its own title bar is hidden; the panel has one).
function yevAgpInner(){if(!S.agp)S.agp=yevNewAgp();return agpHtml().split('onclick="A.closeModal()"').join('onclick="A.yevClose()"');}
function yevPanel(){
 var y=yevS();if(!y.open)return "";
 var a=agentById("agent-events");
 var body=y.tab==="ai"?(a?'<div class="ws" style="grid-template-columns:1fr">'+chatPanel(a,{})+'</div>':'<div class="bd muted small">The AI Planner is not available right now.</div>'):'<div class="bd" id="yev-agp">'+yevAgpInner()+'</div>';
 return '<div class="card yev-panel" id="yev-panel"><div class="hd">'+ic("spark")+'<h3>Agent Planner</h3><div class="yev-tabs" role="tablist"><button class="'+(y.tab==="create"?"on":"")+'" role="tab" onclick="A.yevTab(\'create\')">'+ic("plus")+'Create an event</button><button class="'+(y.tab==="ai"?"on":"")+'" role="tab" onclick="A.yevTab(\'ai\')">'+ic("spark")+'AI Planner</button></div><div class="sp"></div><button class="btn icon ghost" title="Close" aria-label="Close the Agent Planner" onclick="A.yevClose()">'+ic("x")+'</button></div>'+
  (y.tab==="ai"?'<div class="bd small muted" style="padding-bottom:0">Ask for checklists, roles, budgets or announcements for any event idea. Inside an event, its AI Planner tab also sees the live tasks and RSVPs.</div>':'')+body+'</div>';
}
function yevPaint(){
 var el=document.getElementById("yev-agp");if(!el)return false;
 var ae=document.activeElement,foc=!!(ae&&ae.id==="agp-in"),s0=foc?ae.selectionStart:null,s1=foc?ae.selectionEnd:null;
 el.innerHTML=yevAgpInner();
 var ta=document.getElementById("agp-in");
 if(ta&&!ta.disabled&&(foc||(S.agp&&S.agp.focus))){if(S.agp)S.agp.focus=false;try{ta.focus({preventScroll:true});var n=ta.value.length;ta.setSelectionRange(s0==null?n:Math.min(s0,n),s1==null?n:Math.min(s1,n));}catch(e){}}
 var lg=document.getElementById("agp-log");if(lg)lg.scrollTop=lg.scrollHeight;
 try{voPaint();}catch(e){}
 return true;
}
// The Agent Planner's own repaint goes to the panel when it is open.
var yevBaseAgpShow=agpShow;
agpShow=function(){var y=yevS();if(y.open&&y.tab==="create"&&S.agp&&yevPaint())return;yevBaseAgpShow.apply(this,arguments);};
// The Agent Planner forgets its conversation whenever no pop-up is open; while the panel is open that must not happen.
var yevBaseRenderModal=renderModal;
renderModal=function(){
 var y=yevS(),agpModal=typeof S.modal==="string"&&S.modal.indexOf('id="agp-root"')>=0;
 if(y.open&&!agpModal)return agpBaseRenderModal.apply(this,arguments);
 return yevBaseRenderModal.apply(this,arguments);
};
A.agpOpen=function(){
 if(VO.listening){try{VO.rec.stop();}catch(e){}}
 var y=yevS();
 if(y.open&&y.tab==="create"){setTimeout(function(){var p=document.getElementById("yev-panel");if(p)p.scrollIntoView({behavior:"smooth",block:"start"});},0);return;}
 y.open=true;y.tab="create";if(!S.agp||!S.agp.creating)S.agp=yevNewAgp();
 if((S.route||{}).view!=="events"||S.route.id)go("#/events");else render();
 setTimeout(function(){var p=document.getElementById("yev-panel");if(p)p.scrollIntoView({behavior:"smooth",block:"start"});var t=document.getElementById("agp-in");if(t)t.focus({preventScroll:true});},60);
};
A.yevOpen=function(tab){var y=yevS();y.open=true;y.tab=tab==="ai"?"ai":"create";if(y.tab==="create"&&!S.agp)S.agp=yevNewAgp();render();setTimeout(function(){var p=document.getElementById("yev-panel");if(p)p.scrollIntoView({behavior:"smooth",block:"start"});},0);};
A.yevTab=function(t){var y=yevS();y.tab=t==="ai"?"ai":"create";if(y.tab==="create"&&!S.agp)S.agp=yevNewAgp();render();};
A.yevClose=function(){if(VO.listening&&VO.panelId==="agp"){try{VO.rec.stop();}catch(e){}}var y=yevS();y.open=false;if(S.agp&&!S.agp.creating)S.agp=null;render();};
var yevBaseAgpForm=A.agpForm;
A.agpForm=function(){yevS().open=false;return yevBaseAgpForm.apply(this,arguments);};
// Events page: the panel sits under the page title, above the list.
var yevBaseEvents=vEvents;
vEvents=function(){
 var h=yevBaseEvents.apply(this,arguments),y=yevS();
 // After an event is created the conversation ends; close the panel with it.
 if(y.open&&y.tab==="create"&&!S.agp)y.open=false;
 h=h.replace('<span class="muted small">Open an event to plan it with live data</span>','<button class="btn s" onclick="A.yevOpen(\'ai\')">'+ic("spark")+'Open AI Planner</button>');
 h=h.replace('The planner drafts checklists, roles, budgets and announcements from a short brief. It works best inside an event, where it can see the tasks, RSVPs and updates and add its suggestions with one click.','The AI Planner drafts checklists, roles, budgets and announcements from a short brief - open it here for any idea, or inside an event, where it also sees the tasks, RSVPs and updates and adds its suggestions with one click.');
 var p=yevPanel();if(!p)return h;
 var m=h.match(/<div class="evs">|<div class="card"><div class="empty">|<div class="card" style="margin-top:14px"><div class="hd">/);
 return m?h.slice(0,m.index)+p+h.slice(m.index):p+h;
};
// While the panel is open, keep the Agent Planner's text box focused (with its cursor) across background redraws.
var yevBaseRender=render;
render=function(){
 var y=yevS(),ae=document.activeElement,foc=!!(ae&&ae.id==="agp-in"),s0=foc?ae.selectionStart:null,s1=foc?ae.selectionEnd:null;
 var r=yevBaseRender.apply(this,arguments);
 if(y.open&&(foc||(S.agp&&S.agp.focus))){var ta=document.getElementById("agp-in");if(ta&&!ta.disabled){if(S.agp)S.agp.focus=false;try{ta.focus({preventScroll:true});var n=ta.value.length;ta.setSelectionRange(s0==null?n:Math.min(s0,n),s1==null?n:Math.min(s1,n));}catch(e){}}}
 if(y.open){var lg=document.getElementById("agp-log");if(lg)lg.scrollTop=lg.scrollHeight;}
 return r;
};
// ---- deleting an event ----
function yevAfterDelete(title){
 S.event=null;
 var done=function(){toast('"'+(title||"Event")+'" was deleted',"ok");if((S.route||{}).view==="events"&&S.route.id)go("#/events");else render();};
 api("events.list").then(function(l){if(S.boot)S.boot.events=l;}).catch(function(){}).then(done);
}
A.yevDelete=function(id,title,btn){
 if(!confirm('Delete "'+(title||"this event")+'"?\n\nThis removes the event with its tasks, updates, chat and people for everyone. It cannot be undone.'))return;
 if(btn)btn.disabled=true;
 yevApi("events.delete",{eventId:id}).then(function(d){closeModal();var a=S.yevAdm;if(a&&Array.isArray(a.list))a.list=a.list.filter(function(e){return e.id!==id;});yevAfterDelete(d.title||title);})
  .catch(function(e){if(btn)btn.disabled=false;toast(e.message||"Could not delete the event.","err");});
};
// Organisers: a "Delete event" section at the bottom of the event's Edit window.
var yevBaseEditEvent=A.editEvent;
A.editEvent=function(){
 var r=yevBaseEditEvent.apply(this,arguments);
 try{
  var e=S.event&&S.event.event;
  if(e&&typeof S.modal==="string"){
   S.modal+='<div class="yev-danger"><b>'+ic("x")+' Delete this event</b><p>Created it by mistake, or it will not happen? Deleting removes it for everyone, with its tasks, updates and chat. Members are told it was removed. To keep the history instead, set the status to cancelled.</p><button type="button" class="btn s yev-del" onclick="A.yevDelete(\''+attr(e.id)+'\',\''+attr(String(e.title||"").replace(/[\\'"]/g,""))+'\',this)">'+ic("x")+'Delete event</button></div>';
   renderModal();
  }
 }catch(x){}
 return r;
};
// Admins who are in an event but not organising it also get a Delete button on the event page.
var yevBaseEvent=vEvent;
vEvent=function(id){
 var h=yevBaseEvent.apply(this,arguments);
 try{
  var d=S.event;if(!isAdmin()||!d||!d.event||d.event.id!==id)return h;
  var me=(d.members||[]).filter(function(m){return m.member_id===actor().id;})[0];if(me&&me.role==="organizer")return h;
  return h.replace('<a class="btn s ghost" href="#/events">All events</a>','<a class="btn s ghost" href="#/events">All events</a><button class="btn s yev-del" onclick="A.yevDelete(\''+attr(d.event.id)+'\',\''+attr(String(d.event.title||"").replace(/[\\'"]/g,""))+'\',this)">'+ic("x")+'Delete (admin)</button>');
 }catch(x){return h;}
};
// ---- Admin > Events ----
ADM_TABS.push(["events","Events"]);
function yevUnused(e){return Number(e.members)<=1&&Number(e.tasks)===0&&Number(e.updates)===0&&Number(e.messages)===0;}
function yevAdmLoad(force){
 var a=S.yevAdm=S.yevAdm||{list:null,loading:false,err:null,filter:"all",at:0};
 if(a.loading||(!force&&a.list&&Date.now()-a.at<30000))return;
 a.loading=true;
 yevApi("events.admin_list").then(function(d){a.list=d.events||[];a.err=null;}).catch(function(e){a.err=e;}).then(function(){a.loading=false;a.at=Date.now();render();});
}
function yevAdminEvents(){
 var a=S.yevAdm||{};yevAdmLoad(false);a=S.yevAdm;
 if(!a.list&&a.loading)return loadingHtml("Loading events","One moment...");
 if(!a.list)return '<div class="card"><div class="bd small">Could not load events: '+esc((a.err||{}).message||"")+' <a href="#" onclick="A.yevAdmReload();return false">Try again</a></div></div>';
 var unused=a.list.filter(yevUnused),list=a.filter==="unused"?unused:a.list;
 var rows=list.map(function(e){
  var act=[Number(e.tasks)+" tasks",Number(e.updates)+" updates",Number(e.messages)+" chat"].join(" · ");
  return '<div class="yev-row"><div class="t"><b>'+esc(e.title)+'</b><span class="m">Code '+esc(e.code)+' · '+esc(e.status)+(yevUnused(e)?' · <span class="badge warn">looks unused</span>':'')+'</span></div>'+
   '<div class="m">By '+esc(e.owner_name||"Unknown")+(e.guest_owner?' <span class="badge">guest</span>':'')+'<br>Created '+esc(fmtD(e.created_at))+'</div>'+
   '<div class="m">'+(e.starts_at?esc(fmtDT(e.starts_at)):'No date')+'<br>'+Number(e.members)+' people, '+Number(e.going)+' going<br>'+esc(act)+'</div>'+
   '<div class="a"><a class="btn xs" href="#/events/'+attr(e.id)+'">Open</a><button class="btn xs yev-del" onclick="A.yevDelete(\''+attr(e.id)+'\',\''+attr(String(e.title||"").replace(/[\\'"]/g,""))+'\',this)">'+ic("x")+'Delete</button></div></div>';
 }).join("");
 return '<div class="yev-adm"><div class="card"><div class="hd">'+ic("cal")+'<h3>Events ('+a.list.length+')</h3><div class="sp"></div>'+(unused.length?'<button class="btn xs yev-del" onclick="A.yevDeleteUnused()">'+ic("x")+'Delete all '+unused.length+' unused</button>':'')+'<button class="btn xs ghost" onclick="A.yevAdmReload()">'+ic("refresh")+'</button></div><div class="bd">'+
  '<p class="small muted" style="margin:0 0 10px">Every event on Y Square. "Looks unused" means nobody else joined and it has no tasks, updates or chat. Deleting removes the event with everything in it; other members are told.</p>'+
  '<div class="chips"><button class="'+(a.filter!=="unused"?"on":"")+'" onclick="A.yevAdmFilter(\'all\')">All ('+a.list.length+')</button><button class="'+(a.filter==="unused"?"on":"")+'" onclick="A.yevAdmFilter(\'unused\')">Looks unused ('+unused.length+')</button></div>'+
  (rows||'<div class="muted small">No events here.</div>')+'</div></div></div>';
}
A.yevAdmReload=function(){yevAdmLoad(true);render();};
A.yevAdmFilter=function(f){(S.yevAdm=S.yevAdm||{}).filter=f;render();};
A.yevDeleteUnused=function(){
 var a=S.yevAdm;if(!a||!a.list)return;var list=a.list.filter(yevUnused);if(!list.length)return;
 if(!confirm("Delete "+list.length+" unused event"+(list.length===1?"":"s")+"?\n\n"+list.slice(0,10).map(function(e){return "- "+e.title;}).join("\n")+(list.length>10?"\n...":"")+"\n\nThis cannot be undone."))return;
 var ok=0,i=0;
 (function next(){
  if(i>=list.length){toast("Deleted "+ok+" event"+(ok===1?"":"s"),"ok");yevAdmLoad(true);api("events.list").then(function(l){if(S.boot)S.boot.events=l;}).catch(function(){});return;}
  var e=list[i++];yevApi("events.delete",{eventId:e.id}).then(function(){ok++;}).catch(function(){}).then(next);
 })();
};
var yevBaseAdmin=vAdmin;
vAdmin=function(){
 if(!isAdmin()||admS().tab!=="events")return yevBaseAdmin.apply(this,arguments);
 return '<div class="adm-top"><div class="tabs">'+ADM_TABS.map(function(x){return '<button class="'+(admS().tab===x[0]?"on":"")+'" onclick="A.admTab(\''+x[0]+'\')">'+esc(x[1])+'</button>';}).join("")+'</div></div>'+yevAdminEvents();
};
