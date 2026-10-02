// ---- Athlete Edge for every age (yat) -------------------------------------------------------------------------------
// The age groups now run past 22 into adult groups, and the disclaimer under the athlete profile speaks to adults as
// well as young athletes (the agent itself follows the age group: child rules under 18, adult rules from 18).
// Signed in, "Add profile" / "Edit" opens the form with the blanks filled in from the account: the first name as the
// athlete name, and the age group worked out from the month and year of birth given at sign-up (POST /svc/me, workflow
// "Y Square - Account Basics"). Only empty fields are filled, except an old "18-22" that the account's age has
// outgrown (22 used to be the oldest choice). Nothing is saved until the person presses Save profile.
AGE_GROUPS.splice(0,AGE_GROUPS.length,"8-11","12-14","15-17","18-22","23-29","30-39","40-49","50-59","60+");
var YAT={me:null,tok:null,busy:false};
var YAT_OLD_NOTE="Athlete Edge gives food-first guidance for healthy young athletes. It is not medical advice and never recommends supplements or diets for children. For health concerns talk to a parent, doctor or registered dietitian.";
var YAT_NOTE="Athlete Edge gives food-first guidance for athletes of every age. It is not medical advice and never recommends supplements or diets for anyone under 18. For health concerns talk to a doctor or registered dietitian (and a parent for young athletes).";
// Age on the conservative side, as at sign-up: in the birth month itself the birthday counts as not reached yet.
function yatAge(by,bm){var n=new Date(),y=n.getFullYear(),m=n.getMonth()+1;by=Number(by);bm=Number(bm);if(!(by>=1900&&by<=y)||!(bm>=1&&bm<=12))return null;return y-by-(m<=bm?1:0);}
function yatGroup(age){if(age==null||!(age>=0))return "";if(age<12)return "8-11";if(age<15)return "12-14";if(age<18)return "15-17";if(age<23)return "18-22";if(age<30)return "23-29";if(age<40)return "30-39";if(age<50)return "40-49";if(age<60)return "50-59";return "60+";}
function yatLoad(){
 if(!signedIn()){YAT.me=null;YAT.tok=null;return;}
 if(YAT.tok===S.token&&(YAT.me||YAT.busy))return;
 var tok=S.token;YAT.tok=tok;YAT.me=null;YAT.busy=true;
 fetch(BASE+"/svc/me",{method:"POST",headers:headers(),body:"{}"}).then(function(r){return r.json();}).then(function(j){
  YAT.busy=false;if(S.token!==tok)return;
  YAT.me=(j&&j.success&&j.data)?j.data:{};
  if(apOpen())render();
 }).catch(function(){YAT.busy=false;if(S.token===tok)YAT.me={};});
}
// What the open form should start with: the saved profile, plus the account's name and age group where it is blank.
function yatPrefill(p){
 var me=YAT.me||{},a=actor(),out={},hit={};
 var first=String(me.firstName||String(a.name||"").split(" ")[0]||"").trim();
 if(!String(p.athlete_name||"").trim()&&first&&first!=="Guest"){out.athlete_name=first;hit.name=true;}
 var g=yatGroup(yatAge(me.birthYear,me.birthMonth));
 var cur=String(p.age_group||"");
 if(g&&(!cur||(cur==="18-22"&&AGE_GROUPS.indexOf(g)>AGE_GROUPS.indexOf("18-22")))){if(g!==cur){out.age_group=g;hit.age=true;}}
 return {vals:out,hit:hit};
}
var _yatBar=athleteBar;
athleteBar=function(){
 var h,hit={};
 // Asked for as soon as the Athlete Edge page shows, so the values are ready when the form opens.
 if(signedIn()&&S.boot)yatLoad();
 if(signedIn()&&apOpen()&&S.boot){
  var p=S.boot.profile||{};var f=yatPrefill(p);hit=f.hit;
  if(hit.name||hit.age){var keep=S.boot.profile;S.boot.profile=Object.assign({},p,f.vals);try{h=_yatBar();}finally{S.boot.profile=keep;}}
 }
 if(h==null)h=_yatBar();
 h=h.split(YAT_OLD_NOTE).join(YAT_NOTE);
 if(hit.age||hit.name){
  var what=hit.age&&hit.name?"Name and age group":(hit.age?"Age group":"Name");
  h=h.replace('<div class="grid2"><div class="f"><label>Athlete name</label>','<div class="yat-pre small muted">'+ic("user")+' '+what+' filled in from your account'+(hit.age?' (month and year of birth)':'')+'. Change anything before you save.</div><div class="grid2"><div class="f"><label>Athlete name</label>');
 }
 return h;
};
var _yatToggle=A.apToggle;
A.apToggle=function(){var r=_yatToggle.apply(this,arguments);if(apOpen())yatLoad();return r;};
(function(){var st=document.createElement("style");st.id="yatcss";st.textContent=
 ".yat-pre{display:flex;align-items:center;gap:6px;margin:0 0 10px;padding:8px 10px;border-radius:10px;background:var(--muts)}"+
 ".yat-pre svg{flex:none}";
 document.head.appendChild(st);})();
