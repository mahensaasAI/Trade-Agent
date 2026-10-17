// ---- Follow Y Square: Instagram announcements and reels (yfl) ---------------------------------------------------------
// Y Square Community > Follow Y Square (#/follow) shows the promotional announcements and reels an admin has chosen from
// Y Square's Instagram, with a Follow button for the account. Posts are added by their Instagram link in Admin >
// Follow Y Square, where admins also pin, hide, schedule (show from / until), reorder, edit and delete them, change the
// account and intro, switch the section off, and see how often the page is visited, each post is shown and played, and
// the Follow button is tapped. Everything goes through POST /svc/follow (workflow "Y Square - Follow Y Square").
// Nothing loads from Instagram until someone taps a post (or chooses "always load on this device"): Instagram's
// player sets its own cookies. Members under 13 do not see the posts while "hide from under-13s" is on (the default).
ICONS.insta='<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>';
ICONS.play='<path d="M7 4v16l13-8z"/>';
ICONS.img='<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>';
ICONS.arrup='<path d="m18 15-6-6-6 6"/>';
ICONS.arrdn='<path d="m6 9 6 6 6-6"/>';
ICONS.pencil='<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>';
var YFL_PAGES=[["","No button"],["#/startups","Startups"],["#/events","Events"],["#/volunteer","Volunteer"],["#/jobs","Jobs"],["#/athlete","Athlete Edge"],["#/studypals","StudyPals"],["#/plan","My Plan"],["#/account","Sign up / account"]];
var YFL_NODES={};
(function(){var st=document.createElement("style");st.id="yflcss";st.textContent=
 ".yfl-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;margin:0 0 16px}"+
 ".yfl-bar .t{flex:1;min-width:220px;font-size:13px;color:var(--tx2);display:flex;gap:8px;align-items:flex-start}.yfl-bar .t svg{flex:none;margin-top:2px}"+
 ".yfl-bar label{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--tx2);cursor:pointer}.yfl-bar label input{width:auto;margin:0}"+
 ".yfl-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.yfl-chips button{border:1px solid var(--line2);background:var(--panel);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--tx2)}.yfl-chips button.on{border-color:var(--ac);background:var(--acs);color:var(--ac);font-weight:600}"+
 ".yfl-sec{display:flex;gap:8px;align-items:center;margin:6px 0 10px;font-size:13px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.6px}"+
 ".yfl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;margin-bottom:22px;align-items:start}"+
 ".yfl-card{overflow:hidden;display:grid}"+
 ".yfl-ph{position:relative;aspect-ratio:4/5;max-height:440px;width:100%;border:0;cursor:pointer;color:#fff;background:linear-gradient(135deg,#4338ca,#6d28d9);display:grid;place-items:center;font:inherit;padding:18px;text-align:center}"+
 ".yfl-ph:hover .yfl-go,.yfl-ph:focus-visible .yfl-go{transform:scale(1.06)}.yfl-ph:focus-visible{outline:3px solid #fbbf24;outline-offset:-3px}"+
 ".yfl-ph .yfl-go{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.65);display:grid;place-items:center;transition:transform .15s}"+
 ".yfl-ph .yfl-go svg{width:26px;height:26px;fill:#fff}"+
 ".yfl-ph .yfl-k{position:absolute;top:12px;left:12px;display:flex;gap:6px;align-items:center;font-size:12px;font-weight:600;background:rgba(0,0,0,.25);padding:4px 10px;border-radius:999px}"+
 ".yfl-ph .yfl-k svg{width:14px;height:14px}"+
 ".yfl-ph .yfl-h{position:absolute;left:16px;right:16px;bottom:16px;text-align:left;display:grid;gap:4px}.yfl-ph .yfl-h b{font-size:17px;letter-spacing:-.2px;line-height:1.25}.yfl-ph .yfl-h span{font-size:12px;opacity:.85}"+
 ".yfl-slot{display:flex;justify-content:center;background:var(--panel2);min-height:120px;padding:8px 0}"+
 ".yfl-slot .instagram-media{margin:0!important;min-width:300px!important}"+
 ".yfl-bd{padding:14px 16px 16px;display:grid;gap:8px}"+
 ".yfl-bd h3{margin:0;font-size:15.5px;letter-spacing:-.2px}.yfl-bd .cap{margin:0;color:var(--tx2);font-size:13px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}"+
 ".yfl-bd .m{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--tx3)}"+
 ".yfl-bd .a{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}"+
 ".yfl-park{position:absolute;left:-10000px;top:0;width:1px;height:1px;overflow:hidden}"+
 ".yfl-adm .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.yfl-adm .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}"+
 ".yfl-adm .check{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--tx2);margin:2px 0 10px}.yfl-adm .check input{margin-top:3px;width:auto}"+
 ".yfl-adm table.t td{vertical-align:top}.yfl-adm .pt b{display:block;font-size:13.5px}.yfl-adm .pt .badge{margin:4px 4px 0 0}"+
 ".yfl-adm .acts{display:flex;gap:4px;flex-wrap:wrap}.yfl-adm .ord{display:grid;gap:2px}.yfl-adm .ord .btn{padding:2px 6px}"+
 ".yfl-adm .num{white-space:nowrap;font-variant-numeric:tabular-nums}.yfl-adm .num small{display:block;color:var(--tx3);font-size:11px}"+
 ".yfl-del{color:var(--bad,#b91c1c)}"+
 "@media (max-width:760px){.yfl-grid{grid-template-columns:1fr}.yfl-adm .row2,.yfl-adm .row3{grid-template-columns:1fr}}";
 document.head.appendChild(st);})();
function yflApi(action,payload){
 return fetch(BASE+"/svc/follow",{method:"POST",headers:headers(),body:JSON.stringify({action:action,payload:payload||{}})})
  .then(function(r){return r.json().catch(function(){return {success:false,error:{code:"BAD_RESPONSE",message:"The server returned an unexpected response ("+r.status+")."}};});})
  .then(function(j){if(j&&j.success)return j.data;throw (j&&j.error)||{code:"ERROR",message:"Request failed."};},function(){throw {code:"NETWORK",message:"We could not connect. Check your internet connection and try again."};});
}
function yflS(){if(!S.yfl)S.yfl={data:null,loading:false,err:null,at:0,tok:null,filter:"all",loaded:{},hits:{}};return S.yfl;}
function yflAuto(){return LS.get("flAuto",false)===true;}
// Counts once per browser session per post and kind; the server also counts each viewer once a day.
function yflHit(kind,ids){
 var f=yflS(),todo=(ids||[]).filter(function(id){var k=kind+":"+id;if(f.hits[k])return false;f.hits[k]=1;return true;});
 if(kind!=="follow"&&!todo.length)return;
 if(kind==="follow"){if(f.hits["follow"])return;f.hits["follow"]=1;}
 yflApi("follow.hit",{kind:kind,ids:todo}).catch(function(){});
}
function yflLoad(force){
 var f=yflS();
 if(f.tok!==S.token){f.tok=S.token;f.data=null;f.at=0;}
 if(f.loading||(!force&&f.data&&Date.now()-f.at<60000))return;
 f.loading=true;
 yflApi("follow.list").then(function(d){f.data=d||{};f.err=null;}).catch(function(e){f.err=e;}).then(function(){f.loading=false;f.at=Date.now();if((S.route||{}).view==="follow")render();});
}
function yflLink(u){return /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Za-z0-9_-]{5,40}\/$/.test(String(u||""))?String(u):"";}
function yflProfile(h){return h&&/^[A-Za-z0-9._]{1,30}$/.test(h)?"https://www.instagram.com/"+h+"/":"";}
function yflCta(u){u=String(u||"");return /^#\/[a-z0-9][a-z0-9/_-]{0,60}$/i.test(u)||/^https:\/\/(www\.)?ysquareai\.com(\/[A-Za-z0-9/_#?=&.-]*)?$/.test(u)?u:"";}
function yflCard(p){
 var f=yflS(),url=yflLink(p.url);if(!url)return "";
 var reel=p.kind!=="announcement",open=!!(f.loaded[p.id]||yflAuto());
 var kindB='<span class="badge">'+ic(reel?"play":"img")+' '+(reel?"Reel":"Announcement")+'</span>';
 var media=open?'<div class="yfl-slot" data-yfl="'+attr(p.id)+'"></div>':
  '<button type="button" class="yfl-ph" onclick="A.yflOpen(\''+attr(p.id)+'\')" aria-label="'+attr((reel?"Play ":"Show ")+p.title+" from Instagram")+'"><span class="yfl-k">'+ic("insta")+(reel?"Reel":"Announcement")+'</span><span class="yfl-go">'+ic(reel?"play":"img")+'</span><span class="yfl-h"><b>'+esc(p.title)+'</b><span>Tap to '+(reel?"play":"view")+' from Instagram</span></span></button>';
 var cta=yflCta(p.cta_url),ctaL=String(p.cta_label||"");
 return '<div class="card yfl-card" data-id="'+attr(p.id)+'">'+media+'<div class="yfl-bd"><div class="m">'+kindB+(p.pinned?'<span class="badge warn">'+ic("pin")+' Pinned</span>':'')+'<span>'+esc(fmtD(p.starts_at||p.created_at))+'</span></div>'+
  '<h3>'+esc(p.title)+'</h3>'+(p.caption?'<p class="cap">'+esc(p.caption)+'</p>':'')+
  '<div class="a">'+(cta&&ctaL?'<a class="btn p xs" href="'+attr(cta)+'">'+esc(ctaL)+'</a>':'')+'<a class="btn xs ghost" href="'+attr(url)+'" target="_blank" rel="noopener noreferrer" onclick="A.yflOut(\''+attr(p.id)+'\')">'+ic("insta")+'Open on Instagram</a></div></div></div>';
}
function vFollow(){
 var f=yflS();yflLoad(false);
 var d=f.data||{},pr=d.prefs||{},handle=pr.handle||"",prof=yflProfile(handle);
 var intro=pr.intro||"Announcements, highlights and short videos from Y Square. Follow us on Instagram so you never miss a program, event or opening.";
 var h=yscHero("Follow Y Square",esc(intro),prof?'<a class="btn" style="background:#fff;color:#4338ca;border-color:#fff" href="'+attr(prof)+'" target="_blank" rel="noopener noreferrer" onclick="A.yflFollow()">'+ic("insta")+'Follow @'+esc(handle)+' on Instagram</a>':'');
 if(!f.data&&f.loading)return h+loadingHtml("Loading posts","One moment...");
 if(!f.data)return h+'<div class="card"><div class="bd small">We could not load the posts just now. <a href="#" onclick="A.yflReload();return false">Try again</a></div></div>';
 var adm=d.admin===true&&isAdmin();
 if(adm)h+='<div class="card yfl-bar"><div class="t">'+ic("gear")+'<span>You are an admin.'+(pr.enabled===false?' <b>This section is switched off</b> - only admins can see it.':'')+' Add, pin, hide and schedule posts, and see visits and plays, in Admin.</span></div><button class="btn xs p" onclick="A.yflManage()">Manage posts</button></div>';
 if(d.hidden)return h+'<div class="card"><div class="empty"><div class="yscico" style="margin:0 auto 10px">'+ic("insta","ic22")+'</div><b>Instagram is for ages 13 and up</b><div class="small">Follow Y Square shows posts from Instagram, so it is not shown on accounts for members under 13. Ask a parent if you would like to see them together.</div></div></div>';
 if(pr.enabled===false&&!adm)return h+'<div class="card"><div class="empty"><b>Coming soon</b><div class="small">Check back shortly for news and videos from Y Square.</div></div></div>';
 var posts=Array.isArray(d.posts)?d.posts.filter(function(p){return yflLink(p.url);}):[];
 if(!posts.length)return h+'<div class="card"><div class="empty"><div class="yscico" style="margin:0 auto 10px">'+ic("insta","ic22")+'</div><b>No posts yet</b><div class="small">'+(prof?'Meanwhile, see everything on <a href="'+attr(prof)+'" target="_blank" rel="noopener noreferrer">Instagram</a>.':'Check back soon.')+'</div></div></div>';
 var nReel=posts.filter(function(p){return p.kind!=="announcement";}).length,nAnn=posts.length-nReel;
 var fl=f.filter,shown=posts.filter(function(p){return fl==="all"||(fl==="reel"?p.kind!=="announcement":p.kind==="announcement");});
 h+='<div class="card yfl-bar"><div class="t">'+ic("lock")+'<span>Posts load from Instagram only when you tap them. Instagram may then set its own cookies.</span></div><label><input type="checkbox" '+(yflAuto()?"checked ":"")+'onchange="A.yflAutoSet(this.checked)">Always load on this device</label></div>';
 h+='<div class="yfl-chips"><button class="'+(fl==="all"?"on":"")+'" onclick="A.yflFilter(\'all\')">All ('+posts.length+')</button><button class="'+(fl==="announcement"?"on":"")+'" onclick="A.yflFilter(\'announcement\')">Announcements ('+nAnn+')</button><button class="'+(fl==="reel"?"on":"")+'" onclick="A.yflFilter(\'reel\')">Reels and shorts ('+nReel+')</button></div>';
 var pin=shown.filter(function(p){return p.pinned;}),rest=shown.filter(function(p){return !p.pinned;});
 if(pin.length)h+='<div class="yfl-sec">'+ic("pin")+'Pinned</div><div class="yfl-grid">'+pin.map(yflCard).join("")+'</div>';
 if(rest.length)h+=(pin.length?'<div class="yfl-sec">'+ic("insta")+'Latest</div>':'')+'<div class="yfl-grid">'+rest.map(yflCard).join("")+'</div>';
 if(!shown.length)h+='<div class="card"><div class="bd small muted">Nothing here yet.</div></div>';
 S.yflShown=shown.map(function(p){return p.id;});
 return h;
}
// Instagram's player: one script for the whole page; each post is a blockquote it turns into an iframe.
function yflScript(cb){
 if(window.instgrm&&window.instgrm.Embeds){cb();return;}
 var s=document.getElementById("yfl-ig");
 if(!s){s=document.createElement("script");s.id="yfl-ig";s.async=true;s.src="https://www.instagram.com/embed.js";document.body.appendChild(s);}
 s.addEventListener("load",function(){cb();});
}
function yflPark(){
 var pk=document.getElementById("yfl-park");
 if(!pk){pk=document.createElement("div");pk.id="yfl-park";pk.className="yfl-park";pk.setAttribute("aria-hidden","true");document.body.appendChild(pk);}
 Object.keys(YFL_NODES).forEach(function(id){var n=YFL_NODES[id];if(n&&n.isConnected&&n.parentNode!==pk){try{if(pk.moveBefore)pk.moveBefore(n,null);else pk.appendChild(n);}catch(e){pk.appendChild(n);}}});
 return pk;
}
function yflMount(){
 var f=yflS(),posts=((f.data||{}).posts)||[],fresh=false;
 [].forEach.call(document.querySelectorAll(".yfl-slot[data-yfl]"),function(slot){
  var id=slot.getAttribute("data-yfl"),n=YFL_NODES[id];
  if(n){try{if(slot.moveBefore)slot.moveBefore(n,null);else slot.appendChild(n);}catch(e){slot.appendChild(n);}return;}
  var p=posts.filter(function(x){return x.id===id;})[0],url=p&&yflLink(p.url);if(!url)return;
  n=document.createElement("div");n.className="yfl-emb";
  var bq=document.createElement("blockquote");bq.className="instagram-media";bq.setAttribute("data-instgrm-permalink",url+"?utm_source=ig_embed");bq.setAttribute("data-instgrm-version","14");
  bq.style.cssText="background:#fff;border:0;border-radius:12px;margin:0;max-width:540px;min-width:300px;padding:0;width:calc(100% - 16px)";
  var a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="View this post on Instagram";a.style.cssText="display:block;padding:16px;font:14px sans-serif;color:#4338ca";
  bq.appendChild(a);n.appendChild(bq);slot.appendChild(n);YFL_NODES[id]=n;fresh=true;
 });
 if(fresh)yflScript(function(){try{window.instgrm.Embeds.process();}catch(e){}});
}
function yflDrop(){Object.keys(YFL_NODES).forEach(function(id){var n=YFL_NODES[id];if(n&&n.parentNode)n.parentNode.removeChild(n);});YFL_NODES={};}
A.yflOpen=function(id){var f=yflS();f.loaded[id]=1;yflHit("open",[id]);render();};
A.yflOut=function(id){yflHit("click",[id]);};
A.yflFollow=function(){yflHit("follow",[]);};
A.yflFilter=function(x){yflS().filter=x;render();};
A.yflAutoSet=function(on){LS.set("flAuto",!!on);render();};
A.yflReload=function(){yflLoad(true);render();};
A.yflManage=function(){admS().tab="follow";go("#/admin");};
// ---- menu, tab bar and route ----
var yflBaseSidebar=sidebar;
sidebar=function(){
 var h=yflBaseSidebar.apply(this,arguments),v=(S.route||{}).view;
 var i=h.indexOf('href="#/jobs"'),j=i<0?-1:h.indexOf('</a>',i);
 if(j<0){i=h.indexOf('href="#/volunteer"');j=i<0?-1:h.indexOf('</a>',i);}
 if(j<0)return h;
 return h.slice(0,j+4)+'<a href="#/follow" class="'+(v==="follow"?"on":"")+'">'+ic("insta")+'Follow Y Square</a>'+h.slice(j+4);
};
var yflBaseTabbar=tabbar;
tabbar=function(){
 var h=yflBaseTabbar.apply(this,arguments);
 if((S.route||{}).view==="follow")h=h.replace('<button type="button" class="" onclick="A.drawer(true)">','<button type="button" class="on" onclick="A.drawer(true)">');
 return h;
};
var yflBaseRender=render;
render=function(){
 var r=parseHash(),v=r.view;
 yflPark();
 if(v!=="follow"||(S.err&&!S.boot)){yflDrop();return yflBaseRender.apply(this,arguments);}
 S.route=r;var root=document.getElementById("app");
 var body=vFollow();
 root.innerHTML='<div class="shell">'+sidebar()+'<div class="main">'+header("Follow Y Square")+'<div class="content"><div class="wrap">'+body+footerHtml()+'</div></div></div></div>'+tabbar()+'<div class="scrim" onclick="A.drawer(false)"></div>';
 renderModal();try{renderGoogleButtons();}catch(e){}
 yflMount();
 var f=yflS();
 if(f.data&&!f.data.hidden){yflHit("view",["_page"]);if(S.yflShown&&S.yflShown.length)yflHit("view",S.yflShown);}
};
// ---- Admin > Follow Y Square ----
ADM_TABS.push(["follow","Follow Y Square"]);
function yflAdmS(){if(!S.yflAdm)S.yflAdm={data:null,loading:false,err:null,at:0,edit:null,busy:false};return S.yflAdm;}
function yflAdmLoad(force){
 var a=yflAdmS();
 if(a.loading||(!force&&a.data&&Date.now()-a.at<30000))return;
 a.loading=true;
 yflApi("follow.admin_list").then(function(d){a.data=d||{};a.err=null;}).catch(function(e){a.err=e;}).then(function(){a.loading=false;a.at=Date.now();render();});
}
function yflState(p){var now=Date.now();if(p.status==="hidden")return ["Hidden",""];if(p.starts_at&&new Date(p.starts_at).getTime()>now)return ["Scheduled","warn"];if(p.ends_at&&new Date(p.ends_at).getTime()<=now)return ["Ended",""];return ["Live","ok"];}
function yflLocal(v){if(!v)return "";var d=new Date(v);if(isNaN(d))return "";function z(n){return (n<10?"0":"")+n;}return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+"T"+z(d.getHours())+":"+z(d.getMinutes());}
function yflAdmForm(){
 var a=yflAdmS(),e=a.edit||{},isEdit=!!e.id,cta=e.cta_url||"",known=YFL_PAGES.some(function(x){return x[0]===cta;});
 var pages=YFL_PAGES.map(function(x){return '<option value="'+attr(x[0])+'"'+(x[0]===cta?" selected":"")+'>'+esc(x[1])+'</option>';}).join("")+(!known&&cta?'<option value="'+attr(cta)+'" selected>'+esc(cta)+'</option>':'');
 return '<div class="card" id="yfl-form"><div class="hd">'+ic(isEdit?"pencil":"plus")+'<h3>'+(isEdit?"Edit post":"Add a post")+'</h3>'+(isEdit?'<div class="sp"></div><button class="btn xs ghost" onclick="A.yflAdmCancel()">Cancel</button>':'')+'</div><div class="bd"><form onsubmit="return A.yflAdmSave(this)">'+
  '<p class="small muted" style="margin:0 0 12px">Publish the reel or post on Instagram first, then paste its link here. It must be public.</p>'+
  '<div class="f"><label>Instagram link</label><input name="url" required placeholder="https://www.instagram.com/reel/..." value="'+attr(e.url||"")+'"></div>'+
  '<div class="row2"><div class="f"><label>Type</label><select name="kind"><option value="">From the link (reel or post)</option><option value="reel"'+(e.kind==="reel"&&isEdit?" selected":"")+'>Reel or short</option><option value="announcement"'+(e.kind==="announcement"&&isEdit?" selected":"")+'>Announcement</option></select></div>'+
  '<div class="f"><label>Title</label><input name="title" required maxlength="100" placeholder="Summer startup camp - sign-ups open" value="'+attr(e.title||"")+'"></div></div>'+
  '<div class="f"><label>Short description (optional)</label><textarea name="caption" rows="2" maxlength="600" placeholder="One or two lines shown under the post">'+esc(e.caption||"")+'</textarea></div>'+
  '<div class="row2"><div class="f"><label>Button label (optional)</label><input name="ctaLabel" maxlength="30" placeholder="Join the program" value="'+attr(e.cta_label||"")+'"></div><div class="f"><label>Button opens</label><select name="ctaUrl">'+pages+'</select></div></div>'+
  '<div class="row2"><div class="f"><label>Show from (optional)</label><input type="datetime-local" name="startsAt" value="'+attr(yflLocal(e.starts_at))+'"></div><div class="f"><label>Show until (optional)</label><input type="datetime-local" name="endsAt" value="'+attr(yflLocal(e.ends_at))+'"></div></div>'+
  '<label class="check"><input type="checkbox" name="pinned"'+(e.pinned?" checked":"")+'>Pin to the top</label>'+
  '<label class="check"><input type="checkbox" name="hidden"'+(e.status==="hidden"?" checked":"")+'>Keep hidden for now (save as a draft)</label>'+
  '<button class="btn p" type="submit">'+(isEdit?"Save changes":"Add to Follow Y Square")+'</button></form></div></div>';
}
function yflAdmSettings(pr){
 return '<div class="card"><div class="hd">'+ic("gear")+'<h3>Settings</h3></div><div class="bd"><form onsubmit="return A.yflAdmPrefs(this)">'+
  '<div class="row2"><div class="f"><label>Instagram username</label><input name="handle" maxlength="120" placeholder="@ysquare" value="'+attr(pr.handle?"@"+pr.handle:"")+'"><div class="help">Shown as the Follow button.</div></div>'+
  '<div class="f"><label>Intro (optional)</label><input name="intro" maxlength="300" placeholder="Announcements, highlights and short videos from Y Square." value="'+attr(pr.intro||"")+'"></div></div>'+
  '<label class="check"><input type="checkbox" name="enabled"'+(pr.enabled!==false?" checked":"")+'>Show Follow Y Square to everyone (off: only admins see it)</label>'+
  '<label class="check"><input type="checkbox" name="hideUnder13"'+(pr.hideUnder13!==false?" checked":"")+'>Hide the posts from members under 13 (Instagram is for ages 13 and up)</label>'+
  '<button class="btn" type="submit">Save settings</button>'+(pr.updatedBy?'<span class="small muted" style="margin-left:10px">Last changed by '+esc(pr.updatedBy)+' '+esc(fmtD(pr.updatedAt))+'</span>':'')+'</form></div></div>';
}
function yflAdmin(){
 var a=yflAdmS();yflAdmLoad(false);
 if(!a.data&&a.loading)return loadingHtml("Loading Follow Y Square","One moment...");
 if(!a.data)return '<div class="card"><div class="bd small">Could not load Follow Y Square: '+esc((a.err||{}).message||"")+' <a href="#" onclick="A.yflAdmReload();return false">Try again</a></div></div>';
 var d=a.data,pr=d.prefs||{},site=d.site||{},posts=Array.isArray(d.posts)?d.posts:[];
 var cnt={Live:0,Scheduled:0,Hidden:0,Ended:0};posts.forEach(function(p){cnt[yflState(p)[0]]++;});
 function k(v,l){return '<div class="kpi"><b>'+Number(v||0).toLocaleString()+'</b><span>'+esc(l)+'</span></div>';}
 var h='<div class="yfl-adm"><div class="card"><div class="hd">'+ic("insta")+'<h3>Follow Y Square</h3><div class="sp"></div><a class="btn xs ghost" href="#/follow">'+ic("eye")+'View page</a><button class="btn xs ghost" onclick="A.yflAdmReload()" aria-label="Refresh">'+ic("refresh")+'</button></div><div class="bd">'+
  (pr.enabled===false?'<p class="small" style="margin:0 0 10px"><span class="badge warn">Switched off</span> Only admins can see the page right now.</p>':'')+
  '<div class="kpis" style="margin-bottom:10px">'+k(site.visits7,"Page visits, 7 days")+k(site.visits30,"Page visits, 30 days")+k(site.plays30,"Posts played, 30 days")+k(site.follows30,"Follow taps, 30 days")+k(cnt.Live,"Live posts")+k(cnt.Scheduled+cnt.Hidden,"Scheduled or hidden")+'</div>'+
  '<p class="small muted" style="margin:0">Counted on ysquareai.com, each visitor once a day. Likes, comments and views on Instagram itself are in Instagram Insights.</p></div></div>';
 h+=yflAdmForm();
 var rows=posts.map(function(p,i){
  var s=yflState(p),st=p.stats||{};
  return '<tr><td class="ord"><button class="btn xs ghost" '+(i===0?"disabled ":"")+'onclick="A.yflAdmMove(\''+attr(p.id)+'\',-1)" aria-label="Move up">'+ic("arrup")+'</button><button class="btn xs ghost" '+(i===posts.length-1?"disabled ":"")+'onclick="A.yflAdmMove(\''+attr(p.id)+'\',1)" aria-label="Move down">'+ic("arrdn")+'</button></td>'+
   '<td class="pt"><b>'+esc(p.title)+'</b><span class="badge '+s[1]+'">'+s[0]+'</span><span class="badge">'+(p.kind==="announcement"?"Announcement":"Reel")+'</span>'+(p.pinned?'<span class="badge warn">Pinned</span>':'')+
   '<div class="small muted">'+[p.starts_at?'From '+esc(fmtD(p.starts_at)):'',p.ends_at?'Until '+esc(fmtD(p.ends_at)):'','Added by '+esc(p.created_by_name||"an admin")].filter(Boolean).join(' · ')+'</div></td>'+
   '<td class="num">'+Number(st.v7||0)+' / '+Number(st.v30||0)+'<small>shown 7d / 30d</small></td>'+
   '<td class="num">'+Number(st.o30||0)+'<small>played 30d</small></td>'+
   '<td class="num">'+Number(st.c30||0)+'<small>opened on IG 30d</small></td>'+
   '<td><div class="acts"><a class="btn xs ghost" href="'+attr(yflLink(p.url)||"#")+'" target="_blank" rel="noopener noreferrer" title="Open on Instagram">'+ic("insta")+'</a>'+
   '<button class="btn xs ghost" onclick="A.yflAdmEdit(\''+attr(p.id)+'\')">'+ic("pencil")+'Edit</button>'+
   '<button class="btn xs ghost" onclick="A.yflAdmToggle(\''+attr(p.id)+'\',{pinned:'+(!p.pinned)+'})">'+ic("pin")+(p.pinned?"Unpin":"Pin")+'</button>'+
   '<button class="btn xs ghost" onclick="A.yflAdmToggle(\''+attr(p.id)+'\',{status:\''+(p.status==="hidden"?"live":"hidden")+'\'})">'+ic(p.status==="hidden"?"eye":"lock")+(p.status==="hidden"?"Show":"Hide")+'</button>'+
   '<button class="btn xs ghost yfl-del" onclick="A.yflAdmDelete(\''+attr(p.id)+'\')">'+ic("x")+'Delete</button></div></td></tr>';
 }).join("");
 h+='<div class="card"><div class="hd">'+ic("chart")+'<h3>Posts ('+posts.length+')</h3></div><div class="bd">'+
  (rows?'<div class="tw"><table class="t"><thead><tr><th>Order</th><th>Post</th><th>Shown</th><th>Played</th><th>Opened</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="small muted" style="margin:0">Pinned posts come first, then this order. Scheduled posts appear on their "show from" date; ended ones stay here until you delete them.</p>':'<div class="muted small">No posts yet. Add the first one above.</div>')+
  '</div></div>';
 h+=yflAdmSettings(pr);
 return h+'</div>';
}
A.yflAdmReload=function(){yflAdmLoad(true);render();};
A.yflAdmCancel=function(){yflAdmS().edit=null;render();};
A.yflAdmEdit=function(id){var a=yflAdmS();a.edit=((a.data||{}).posts||[]).filter(function(p){return p.id===id;})[0]||null;render();setTimeout(function(){var el=document.getElementById("yfl-form");if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},0);};
function yflIso(v){if(!v)return "";var d=new Date(v);return isNaN(d)?"":d.toISOString();}
function yflAfterChange(msg){toast(msg,"ok");yflAdmLoad(true);var f=yflS();f.at=0;}
A.yflAdmSave=function(form){
 var a=yflAdmS(),o=fd(form),e=a.edit||{};
 var post={id:e.id||undefined,url:o.url,kind:o.kind||(e.id?e.kind:""),title:o.title,caption:o.caption,ctaLabel:o.ctaLabel,ctaUrl:o.ctaLabel?o.ctaUrl:"",startsAt:yflIso(o.startsAt),endsAt:yflIso(o.endsAt),pinned:!!form.pinned.checked,status:form.hidden.checked?"hidden":"live"};
 if(post.ctaLabel&&!post.ctaUrl){toast("Choose the page the button opens, or leave the label empty.","err");return false;}
 busyBtn(form,true);
 yflApi("follow.save",{post:post}).then(function(){a.edit=null;yflAfterChange(e.id?"Post updated":"Post added to Follow Y Square");}).catch(function(err){toast(err.message||"Could not save","err");busyBtn(form,false);});
 return false;
};
A.yflAdmToggle=function(id,ch){yflApi("follow.toggle",Object.assign({id:id},ch)).then(function(){yflAfterChange(ch.status?(ch.status==="hidden"?"Post hidden":"Post is live"):(ch.pinned?"Post pinned":"Post unpinned"));}).catch(function(err){toast(err.message,"err");});};
A.yflAdmDelete=function(id){
 var a=yflAdmS(),p=((a.data||{}).posts||[]).filter(function(x){return x.id===id;})[0];if(!p)return;
 if(!confirm('Delete "'+p.title+'" from Follow Y Square?\n\nIt stays on Instagram. Its counts here are removed. This cannot be undone.'))return;
 yflApi("follow.delete",{id:id}).then(function(){if(a.edit&&a.edit.id===id)a.edit=null;yflAfterChange("Post deleted");}).catch(function(err){toast(err.message,"err");});
};
A.yflAdmMove=function(id,dir){
 var a=yflAdmS(),posts=((a.data||{}).posts||[]).slice(),i=-1;posts.forEach(function(p,k){if(p.id===id)i=k;});
 var j=i+dir;if(i<0||j<0||j>=posts.length)return;
 var t=posts[i];posts[i]=posts[j];posts[j]=t;a.data.posts=posts;render();
 yflApi("follow.order",{ids:posts.map(function(p){return p.id;})}).then(function(){var f=yflS();f.at=0;yflAdmLoad(true);}).catch(function(err){toast(err.message,"err");yflAdmLoad(true);});
};
A.yflAdmPrefs=function(form){
 var o=fd(form);busyBtn(form,true);
 yflApi("follow.prefs",{handle:o.handle,intro:o.intro,enabled:!!form.enabled.checked,hideUnder13:!!form.hideUnder13.checked}).then(function(){busyBtn(form,false);yflAfterChange("Settings saved");}).catch(function(err){toast(err.message,"err");busyBtn(form,false);});
 return false;
};
var yflBaseAdmin=vAdmin;
vAdmin=function(){
 if(!isAdmin()||admS().tab!=="follow")return yflBaseAdmin.apply(this,arguments);
 return '<div class="adm-top"><div class="tabs">'+ADM_TABS.map(function(x){return '<button class="'+(admS().tab===x[0]?"on":"")+'" onclick="A.admTab(\''+x[0]+'\')">'+esc(x[1])+'</button>';}).join("")+'</div></div>'+yflAdmin();
};
