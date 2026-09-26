// ---- Y Square Community: Startups and Jobs (ysc) ------------------------------------------------------------------------
// "Community" in the menu is now "Y Square Community", with two new pages next to Volunteer:
//  - Startups: Y Square's startup goal, the Entrepreneurship and Startup Program for middle and high schoolers, and a
//    "send us a message" form. Messages go to POST /svc/interest (workflow "Y Square - Ecosystem Interest"), which
//    stores them in ys_interest and notifies admins in the app. Students under 13 are asked to have a parent send it.
//  - Jobs: the top 10 openings from Y Combinator's job board (one per company), refreshed every morning by the
//    "Y Square - Startup Jobs (Y Combinator)" workflow into settings.organization.startupJobs. Nothing is made up here:
//    with no saved list the page says so and links to the board.
ICONS.rocket='<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>';
ICONS.briefcase='<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>';
NT_KIND.interest=["rocket","ac"];
var YSC_VIEWS={startups:"Startups",jobs:"Startup Jobs"};
var YSC_YC="https://www.ycombinator.com/";
(function(){var st=document.createElement("style");st.id="ysccss";st.textContent=
 ".yscsec{margin:28px 0 14px}.yscsec h2{font-size:20px;letter-spacing:-.3px;margin:0 0 6px}.yscsec p{margin:0;color:var(--tx2);max-width:760px}"+
 ".yscstory .bd p{margin:0 0 12px;color:var(--tx2);line-height:1.65;max-width:780px}.yscstory .bd p:last-child{margin-bottom:0}"+
 ".yscstory .goal{font-size:17px;font-weight:700;color:var(--tx);letter-spacing:-.2px}"+
 ".ysctracks{display:grid;grid-template-columns:1fr 1fr;gap:18px}"+
 ".ysctrack{padding:22px;display:grid;gap:10px;align-content:start}.ysctrack h3{margin:0;font-size:16.5px;letter-spacing:-.2px}"+
 ".ysctrack ul{margin:0;padding-left:18px;color:var(--tx2);display:grid;gap:6px;font-size:13.5px;line-height:1.5}"+
 ".yscico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff;background:var(--ac)}"+
 ".yscico.hs{background:linear-gradient(135deg,#4338ca,#6d28d9)}"+
 ".yscsteps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}"+
 ".yscstep{padding:18px;display:grid;gap:6px;align-content:start}.yscstep b{font-size:14px}.yscstep span{color:var(--tx2);font-size:13px;line-height:1.5}"+
 ".yscn{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--acs);color:var(--ac);font-weight:700;font-size:13px}"+
 ".yscform .f{align-content:start}.yscform .check{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--tx2);margin:2px 0 12px}.yscform .check input{margin-top:3px;width:auto}"+
 ".ysctrap{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}"+
 ".yscdone{display:flex;gap:12px;align-items:flex-start}.yscdone .yscico{background:var(--ok)}"+
 ".yscjobs{display:grid;gap:14px}"+
 ".yscjob{padding:18px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start}"+
 ".ysclogo{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:var(--acs);color:var(--ac);font-weight:700;font-size:14px}"+
 ".yscjob h3{margin:0 0 2px;font-size:15.5px;letter-spacing:-.2px}.yscjob .co{font-size:13px;color:var(--tx2)}"+
 ".yscjob .about{margin:6px 0 8px;color:var(--tx2);font-size:13px;line-height:1.5}.yscjob .m{display:flex;gap:6px;flex-wrap:wrap}"+
 ".yscjob .m .badge{white-space:normal;max-width:100%}.yscsrc svg{flex:none}"+
 ".yscjob .yscact{display:grid;gap:6px;justify-items:end}"+
 ".yscsrc{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px;font-size:12.5px;color:var(--tx3)}"+
 "@media (max-width:1000px){.yscsteps{grid-template-columns:1fr 1fr}}"+
 "@media (max-width:760px){.ysctracks,.yscsteps{grid-template-columns:1fr}.yscjob{grid-template-columns:auto 1fr}.yscjob .yscact{grid-column:1/-1;justify-items:start;grid-auto-flow:column;justify-content:start}}";
 document.head.appendChild(st);})();
function yscHero(title,text,btns){
 return '<div class="hero" style="grid-template-columns:1fr;margin-bottom:16px"><div class="lead"><span class="badge" style="background:rgba(255,255,255,.18);color:#fff;width:max-content">Y Square Community</span><h2>'+title+'</h2><p>'+text+'</p>'+(btns?'<div class="row" style="margin-top:6px;gap:8px;flex-wrap:wrap">'+btns+'</div>':'')+'</div></div>';
}
function yscScroll(id){var el=document.getElementById(id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});}
A.yscGo=function(id){yscScroll(id);};
// ---- Startups page ----
function vStartups(){
 var h=yscHero("Build the next billion-dollar startup",
  "Y Square's goal is to help create a billion-dollar startup from young founders like you. Our cohort program gives middle and high school students the platform to turn big ideas into real companies.",
  '<button class="btn" style="background:#fff;color:#4338ca;border-color:#fff" onclick="A.yscGo(\'yscform\')">'+ic("send")+'I am interested</button><a class="btn" style="background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.35)" href="#/jobs">'+ic("briefcase")+'See startup jobs</a>');
 h+='<div class="card yscstory"><div class="hd">'+ic("rocket")+'<h3>Our story</h3></div><div class="bd">'+
  '<p>Every great company started as a small idea - usually from someone who noticed a problem and decided to fix it. We believe many of tomorrow\'s founders are in middle and high school classrooms today.</p>'+
  '<p class="goal">Our goal: a billion-dollar startup, built by young founders like you.</p>'+
  '<p>That is why we are building the Y Square cohort program. It gives students a platform - people to build with, mentors to learn from and AI tools to build faster - so they can chase their ideas and fulfil their dreams.</p>'+
  '</div></div>';
 h+='<div class="yscsec" id="yscprogram"><h2>Y Square Entrepreneurship and Startup Program</h2><p>A cohort program for middle and high schoolers. Students learn together, work on a problem they care about and build something real.</p></div>';
 h+='<div class="ysctracks">'+
  '<div class="card ysctrack"><div class="yscico">'+ic("spark")+'</div><span class="badge info" style="width:max-content">Grades 6-8</span><h3>Middle school</h3><ul><li>Learn how startups begin: spotting problems worth solving</li><li>Brainstorm ideas and work as a team</li><li>Build a first simple project and share it</li></ul></div>'+
  '<div class="card ysctrack"><div class="yscico hs">'+ic("rocket")+'</div><span class="badge info" style="width:max-content">Grades 9-12</span><h3>High school</h3><ul><li>Go from idea to a working prototype, using AI tools</li><li>Talk to real users and learn what they need</li><li>Learn the basics of business and funding, then pitch your startup</li></ul></div>'+
  '</div>';
 h+='<div class="yscsec"><h2>How the cohort works</h2></div><div class="yscsteps">'+
  [["Join a cohort","Learn alongside other students who want to build."],["Pick a problem","Choose something you care about and want to fix."],["Build it","Turn your idea into a prototype with mentors and Y Square's AI tools."],["Launch and pitch","Show what you built and tell its story."]].map(function(s,i){return '<div class="card yscstep"><span class="yscn">'+(i+1)+'</span><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div>';}).join("")+
  '</div><p class="muted small" style="margin:12px 0 0">Dates and details for each cohort are shared with everyone who sends us a message below.</p>';
 h+='<div class="yscsec" id="yscform"><h2>Be part of the Y Square ecosystem</h2><p>Interested? Send us a message - whether you are a student, a parent, a teacher, or a founder, mentor or investor who wants to help.</p></div>'+yscForm();
 return h;
}
function yscForm(){
 var st=S.ysc||{},d=S.yscDraft||{},a=actor();
 if(st.sent)return '<div class="card yscform"><div class="bd yscdone"><div class="yscico">'+ic("check")+'</div><div><b>Thanks'+(st.name?', '+esc(st.name):'')+'! Your message is on its way.</b><div class="muted small" style="margin-top:4px">The Y Square team will reply to the email address you gave us.</div><button class="btn s" style="margin-top:10px" onclick="A.yscAgain()">Send another message</button></div></div></div>';
 var name=d.name!=null?d.name:(signedIn()?a.name||"":"");
 var email=d.email!=null?d.email:(signedIn()?(a.email||(S.user||{}).email||""):"");
 var role=d.role||"",grade=d.grade||"";
 function opt(v,l,cur){return '<option value="'+attr(v)+'"'+(v===cur?' selected':'')+'>'+esc(l)+'</option>';}
 var roles=[["","Choose one"],["student","Student"],["parent","Parent or guardian"],["educator","Teacher or coach"],["mentor","Founder, mentor or investor"],["other","Other"]];
 var grades=[["","Not a student"]].concat(["6","7","8","9","10","11","12"].map(function(g){return [g,"Grade "+g];}));
 return '<div class="card yscform"><div class="bd"><form onsubmit="return A.yscSend(this)" oninput="A.yscInput(event)" onchange="A.yscInput(event)" novalidate>'+
  '<div class="grid2"><div class="f"><label for="yscname">Your name *</label><input id="yscname" name="name" maxlength="80" autocomplete="name" value="'+attr(name)+'" required></div>'+
  '<div class="f"><label for="yscemail">Email *</label><input id="yscemail" name="email" type="email" maxlength="200" autocomplete="email" value="'+attr(email)+'" required><span class="help">We only use this to reply to you.</span></div></div>'+
  '<div class="grid2"><div class="f"><label for="yscrole">I am a *</label><select id="yscrole" name="role" required>'+roles.map(function(r){return opt(r[0],r[1],role);}).join("")+'</select></div>'+
  '<div class="f"><label for="yscgrade">Grade</label><select id="yscgrade" name="grade">'+grades.map(function(g){return opt(g[0],g[1],grade);}).join("")+'</select></div></div>'+
  '<div class="f"><label for="yscmsg">Message</label><textarea id="yscmsg" name="message" maxlength="1500" placeholder="Tell us about your idea, what you would like to learn, or how you would like to help.">'+esc(d.message||"")+'</textarea></div>'+
  '<label class="check" id="yscage" style="'+(role==="student"?'':'display:none')+'"><input type="checkbox" name="over13"'+(d.over13?' checked':'')+'><span>I am 13 or older. <span class="muted">Under 13? Please ask a parent or guardian to send this message for you.</span></span></label>'+
  '<div class="ysctrap" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>'+
  (st.err?'<div class="small" style="color:var(--err);margin:0 0 10px" role="alert">'+esc(st.err)+'</div>':'')+
  '<div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn p" type="submit"'+(st.busy?' disabled':'')+'>'+ic("send")+(st.busy?'Sending...':'Send message')+'</button><span class="small muted">See our <a href="#/privacy">Privacy Policy</a>.</span></div>'+
  '</form></div></div>';
}
A.yscInput=function(e){
 var el=e&&e.target;if(!el||!el.name||el.name==="website")return;
 S.yscDraft=S.yscDraft||{};S.yscDraft[el.name]=el.type==="checkbox"?el.checked:el.value;
 if(el.name==="role"){var w=document.getElementById("yscage");if(w)w.style.display=el.value==="student"?"":"none";}
};
A.yscAgain=function(){S.ysc={};S.yscDraft={};render();setTimeout(function(){yscScroll("yscform");},0);};
A.yscSend=function(f){
 var st=S.ysc=S.ysc||{};if(st.busy)return false;
 var v=function(n){return String((f.elements[n]||{}).value||"").trim();};
 var body={name:v("name"),email:v("email"),role:v("role"),grade:v("grade"),message:v("message"),over13:!!(f.elements.over13&&f.elements.over13.checked),website:v("website")};
 var err=!body.name?"Please tell us your name.":!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)?"Please enter an email address we can reply to.":!body.role?"Please choose who you are.":(body.role==="student"&&!body.over13)?"Students under 13: please ask a parent or guardian to send this message for you.":"";
 if(err){st.err=err;render();setTimeout(function(){yscScroll("yscform");},0);return false;}
 st.busy=true;st.err="";render();
 fetch(BASE+"/svc/interest",{method:"POST",headers:{"Content-Type":"application/json","X-Guest-Id":S.guestId},body:JSON.stringify(body)})
  .then(function(r){return r.json().catch(function(){return {success:false,error:{message:"The server returned an unexpected response ("+r.status+")."}};});})
  .then(function(j){st.busy=false;if(j&&j.success){S.ysc={sent:true,name:body.name.split(" ")[0]};S.yscDraft={};}else{st.err=((j&&j.error)||{}).message||"We could not send your message. Please try again.";}},
        function(){st.busy=false;st.err="We could not connect. Check your internet connection and try again.";})
  .then(function(){render();setTimeout(function(){yscScroll("yscform");},0);});
 return false;
};
// ---- Jobs page ----
function yscJobUrl(u){u=String(u||"");return u.indexOf(YSC_YC)===0?u:"";}
function yscInitials(n){var p=String(n||"").replace(/[^A-Za-z0-9 ]/g," ").trim().split(/\s+/);return ((p[0]||"")[0]||"").toUpperCase()+((p[1]||"")[0]||"").toUpperCase();}
function yscJobCard(j){
 var url=yscJobUrl(j.url),co=yscJobUrl(j.companyUrl);if(!url)return "";
 var badges=[j.location?'<span class="badge">'+ic("map")+' '+esc(j.location)+'</span>':'',j.type?'<span class="badge">'+ic("clock")+' '+esc(j.type)+'</span>':'',j.role?'<span class="badge info">'+esc(j.role)+'</span>':'',j.salary?'<span class="badge">'+esc(j.salary)+'</span>':'',j.experience?'<span class="badge">'+esc(j.experience)+(/year/i.test(j.experience)?' experience':'')+'</span>':''].join("");
 return '<div class="card yscjob"><div class="ysclogo" aria-hidden="true">'+esc(yscInitials(j.company))+'</div><div style="min-width:0"><h3>'+esc(j.title)+'</h3><div class="co"><b>'+esc(j.company)+'</b>'+(j.batch?' &middot; YC '+esc(j.batch):'')+'</div>'+(j.about?'<div class="about">'+esc(j.about)+'</div>':'')+'<div class="m">'+badges+'</div></div>'+
  '<div class="yscact"><a class="btn s p" href="'+attr(url)+'" target="_blank" rel="noopener noreferrer">'+ic("link")+'View job</a>'+(co?'<a class="btn xs ghost" href="'+attr(co)+'" target="_blank" rel="noopener noreferrer">About '+esc(j.company)+'</a>':'')+'</div></div>';
}
function vJobs(){
 var feed=((((S.boot||{}).settings||{}).organization)||{}).startupJobs||null;
 var jobs=feed&&Array.isArray(feed.jobs)?feed.jobs.filter(function(j){return j&&yscJobUrl(j.url);}).slice(0,10):[];
 var h=yscHero("Top 10 startup jobs","Current openings at Y Combinator startups - a look at what fast-growing startups hire for. Most of these roles are for experienced professionals, but they show the skills worth building now.",
  '<a class="btn" style="background:#fff;color:#4338ca;border-color:#fff" href="'+YSC_YC+'jobs" target="_blank" rel="noopener noreferrer">'+ic("link")+'All jobs on ycombinator.com</a><a class="btn" style="background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.35)" href="#/startups">'+ic("rocket")+'Y Square Startup Program</a>');
 if(!S.boot)return h+loadingHtml("Loading jobs","One moment...");
 if(!jobs.length)return h+'<div class="card"><div class="empty"><div class="yscico" style="margin:0 auto 10px">'+ic("briefcase","ic22")+'</div><b>No job listings to show right now</b><div class="small">You can see every opening on <a href="'+YSC_YC+'jobs" target="_blank" rel="noopener noreferrer">Y Combinator\'s job board</a>.</div></div></div>';
 h+='<div class="yscsrc">'+ic("refresh")+'<span>From <a href="'+YSC_YC+'jobs" target="_blank" rel="noopener noreferrer">Y Combinator\'s job board</a>, one job per company, updated daily'+(feed.fetchedAt?' - last updated '+esc(fmtD(feed.fetchedAt))+'.':'.')+' Applications happen on ycombinator.com.</span></div>';
 h+='<div class="yscjobs">'+jobs.map(yscJobCard).join("")+'</div>';
 h+='<div class="card" style="margin-top:18px"><div class="bd row" style="gap:12px;flex-wrap:wrap"><div class="yscico hs">'+ic("rocket")+'</div><div style="flex:1;min-width:200px"><b>Want to build your own startup?</b><div class="muted small">Join the Y Square Entrepreneurship and Startup Program for middle and high schoolers.</div></div><a class="btn p" href="#/startups">Learn more</a></div></div>';
 return h;
}
// ---- menu, phone tab bar, volunteer badge and routes ----
var yscBaseSidebar=sidebar;
sidebar=function(){
 var h=yscBaseSidebar.apply(this,arguments),v=(S.route||{}).view;
 h=h.replace('<div class="sec">Community</div>','<div class="sec">Y Square Community</div>');
 var i=h.indexOf('href="#/volunteer"'),j=i<0?-1:h.indexOf('</a>',i);
 if(j<0)return h;
 function item(k,icn,label){return '<a href="#/'+k+'" class="'+(v===k?"on":"")+'">'+ic(icn)+esc(label)+'</a>';}
 return h.slice(0,j+4)+item("startups","rocket","Startups")+item("jobs","briefcase","Jobs")+h.slice(j+4);
};
var yscBaseTabbar=tabbar;
tabbar=function(){
 var h=yscBaseTabbar.apply(this,arguments);
 if(YSC_VIEWS[(S.route||{}).view])h=h.replace('<button type="button" class="" onclick="A.drawer(true)">','<button type="button" class="on" onclick="A.drawer(true)">');
 return h;
};
var yscBaseVolunteer=vVolunteer;
vVolunteer=function(){return yscBaseVolunteer.apply(this,arguments).replace('>Community</span><h2>Volunteer opportunities','>Y Square Community</span><h2>Volunteer opportunities');};
var yscBaseRender=render;
render=function(){
 var r=parseHash(),v=r.view;
 if(!YSC_VIEWS[v]||(S.err&&!S.boot))return yscBaseRender.apply(this,arguments);
 S.route=r;var root=document.getElementById("app");
 var body=v==="jobs"?vJobs():vStartups();
 root.innerHTML='<div class="shell">'+sidebar()+'<div class="main">'+header(YSC_VIEWS[v])+'<div class="content"><div class="wrap">'+body+footerHtml()+'</div></div></div></div>'+tabbar()+'<div class="scrim" onclick="A.drawer(false)"></div>';
 renderModal();try{renderGoogleButtons();}catch(e){}
};

