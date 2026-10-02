// ---- One place to sign in: the account menu at the top right (ysa) -----------------------------------------------------
// Like Google's apps: signed out, the header shows one "Sign in" button that opens the sign-in page (#/account, which
// keeps Google sign-in, email sign-in and sign-up). Signed in, the header shows the member's picture or initials; it
// opens a card with their name, email and plan, "Manage your account" and "Sign out". Everywhere else the extra
// sign-in buttons and links are taken out: the "Guest" chip, the menu's "Sign in / Sign up" and "Account" items, the
// plan box button, and the buttons and links inside pages (a link becomes plain text). Pop-ups that are a step of
// something the person started (upgrading, saving) still offer sign-in, and so does the sign-in page itself.
(function(){var st=document.createElement("style");st.id="ysacss";st.textContent=
 ".ysa{position:relative;display:flex;align-items:center}"+
 ".ysa-av{width:40px;height:40px;padding:3px;border:0;border-radius:50%;background:transparent;cursor:pointer;display:grid;place-items:center}"+
 ".ysa-av:hover,.ysa-av[aria-expanded=true]{background:var(--muts)}"+
 ".ysa-av:focus-visible{outline:2px solid var(--ac);outline-offset:2px}"+
 ".ysa-av .av{width:32px;height:32px;font-size:12px}"+
 ".ysa-p{position:absolute;right:0;top:calc(100% + 10px);width:340px;max-width:calc(100vw - 24px);padding:16px 18px 12px;background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:0 14px 36px rgba(15,23,42,.18);z-index:60;text-align:center;display:grid;gap:10px;justify-items:center}"+
 ".ysa-mail{font-size:13px;color:var(--tx2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
 ".ysa-p .av.big{width:76px;height:76px;font-size:28px;margin-top:4px}"+
 ".ysa-hi{font-size:20px;font-weight:600;letter-spacing:-.3px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
 ".ysa-p .btn.ysa-man{border-radius:999px;padding:8px 18px;border-color:var(--line2)}"+
 ".ysa-p .btn.ysa-out{width:100%;justify-content:center;border-radius:14px;margin-top:4px}"+
 ".ysa-foot{display:flex;gap:10px;justify-content:center;font-size:11.5px;color:var(--tx3);padding-top:2px}.ysa-foot a{color:var(--tx3)}"+
 ".ysa-in{white-space:nowrap}"+
 ".v39act:empty{display:none}";
 document.head.appendChild(st);})();
var YSA={open:false,hash:""};
function ysaInitials(a){return esc(a.initials||initialsOf(a.name||""));}
function ysaAvatar(a,big){var u=a.avatarUrl||a.avatar_url||"";return '<span class="av'+(big?' big':'')+'" aria-hidden="true">'+(u?'<img src="'+attr(u)+'" alt="" referrerpolicy="no-referrer">':ysaInitials(a))+'</span>';}
function ysaEmail(a){return a.email||((S.user||{}).email)||((S.account||{}).user||{}).email||"";}
function ysaPlan(){try{return tierName(myTier());}catch(e){return isPremium()?"Premium":"Free";}}
function ysaInner(){
 var a=actor();
 if(!signedIn()){
  var onSignIn=(S.route||{}).view==="account";
  return onSignIn?'':'<button type="button" class="btn s p ysa-in" onclick="A.ysaSignIn()">'+ic("user")+'Sign in</button>';
 }
 var first=String(a.name||"").trim().split(/\s+/)[0]||"there";
 var h='<button type="button" class="ysa-av" title="Your account" aria-label="Your account: '+attr(a.name||"")+'" aria-haspopup="true" aria-expanded="'+(YSA.open?'true':'false')+'" onclick="A.ysaToggle(event)">'+ysaAvatar(a)+'</button>';
 if(!YSA.open)return h;
 return h+'<div class="ysa-p" role="dialog" aria-label="Your account">'+
  '<div class="ysa-mail">'+esc(ysaEmail(a))+'</div>'+ysaAvatar(a,true)+
  '<div class="ysa-hi">Hi, '+esc(first)+'!</div>'+
  '<span class="badge'+(isPremium()?' ac':'')+'">'+esc(ysaPlan())+' plan</span>'+
  '<a class="btn ysa-man" href="#/account" onclick="A.ysaClose()">Manage your account</a>'+
  '<button type="button" class="btn ysa-out" onclick="A.ysaClose();A.signOut()">'+ic("out")+'Sign out</button>'+
  '<div class="ysa-foot"><a href="#/privacy" onclick="A.ysaClose()">Privacy Policy</a><span>&middot;</span><a href="#/terms" onclick="A.ysaClose()">Terms</a></div></div>';
}
function ysaPaint(){var el=document.getElementById("ysaw");if(el)el.innerHTML=ysaInner();}
A.ysaSignIn=function(){openSignIn();};
A.ysaToggle=function(e){if(e)e.stopPropagation();YSA.open=!YSA.open;if(YSA.open&&typeof NT!=="undefined"&&NT.open){NT.open=false;ntPaint();}ysaPaint();};
A.ysaClose=function(){if(YSA.open){YSA.open=false;ysaPaint();}};
document.addEventListener("click",function(e){if(YSA.open&&!e.target.closest("#ysaw")){YSA.open=false;ysaPaint();}});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&YSA.open){YSA.open=false;ysaPaint();var b=document.querySelector("#ysaw .ysa-av");if(b)b.focus();}});
// Header: drop the old Sign in button and the name chip, add the account control at the right-hand end.
var ysaBaseHeader=header;
header=function(title){
 var h=ysaBaseHeader.apply(this,arguments);
 h=h.replace(/<button class="btn s p" onclick="A\.openSignIn\(\)">(?:(?!<\/button>)[\s\S])*<\/button>/,"");
 h=h.replace(/<a class="who" href="#\/account">[\s\S]*?<\/a>/,"");
 var j=h.lastIndexOf("</div>");
 return j<0?h:h.slice(0,j)+'<div class="ysa" id="ysaw">'+ysaInner()+'</div>'+h.slice(j);
};
// The account card closes when the page changes.
var ysaBaseRender=render;
render=function(){if(YSA.hash!==location.hash){YSA.hash=location.hash;YSA.open=false;}var r=ysaBaseRender.apply(this,arguments);ysaSweep();return r;};
// Limit messages: keep the upgrade button, the sign-in button moves to the header.
var ysaBaseLimitButtons=limitButtons;
limitButtons=function(){return ysaBaseLimitButtons.apply(this,arguments).replace(/<button class="btn s p" onclick="A\.openSignIn\(\)">(?:(?!<\/button>)[\s\S])*<\/button>/g,"").replace(/<div class="row"[^>]*><\/div>/,"");};
// Takes the other sign-in buttons and links out of the menu and the pages (not the header, pop-ups or sign-in page).
function ysaSweep(){
 var app=document.getElementById("app");if(!app)return;
 var sb=app.querySelector(".sb");
 if(sb){
  sb.querySelectorAll('a[href="#/account"]').forEach(function(a){a.remove();});
  sb.querySelectorAll('button[onclick^="A.openSignIn"]').forEach(function(b){b.remove();});
  sb.querySelectorAll(".nav .sec,nav .sec").forEach(function(sec){var n=sec.nextElementSibling;if(!n||n.classList.contains("sec"))sec.remove();});
 }
 if((S.route||{}).view==="account")return;
 var main=app.querySelector(".main .content");if(!main)return;
 main.querySelectorAll('button[onclick^="A.openSignIn"]').forEach(function(b){
  var p=b.parentElement;b.remove();
  if(p&&p.classList&&p.classList.contains("f")&&!p.querySelector("input,select,textarea,button"))p.remove();
 });
 main.querySelectorAll('a[onclick^="A.openSignIn"]').forEach(function(a){a.replaceWith(document.createTextNode(a.textContent));});
}
// Parts of a page that redraw on their own (chat replies, StudyPals bar) get the same clean-up.
(function(){
 var app=document.getElementById("app");if(!app||!window.MutationObserver)return;
 var queued=false;
 new MutationObserver(function(){if(queued)return;queued=true;setTimeout(function(){queued=false;ysaSweep();},0);}).observe(app,{childList:true,subtree:true});
})();
