// ---- Chat layout for the agents (ych) ----------------------------------------------------------------------------------
// Athlete Edge, SynthIQ and StudyPals (Tutor and Ask AI) give the conversation the room. On a laptop the page no longer
// scrolls: the settings bar, the chat and a slim footer fit the window, and the chat takes all the height that is left.
// - SynthIQ's sources and filters sit on one line; the filters open from a "Filters" button that counts what is set.
// - StudyPals' grade, subject and topic sit on one line, with slimmer tabs.
// - The disclaimers ("not medical advice", "a study aid", which Tutor answers from) move from above the chat to one
//   small line under the message box, the way chat apps show them. They show on phones too, where they used to be hidden.
var YCH={fil:false};
var YCH_NOTES={
 "agent-synthiq":"SynthIQ searches only the sources you switch on and cites what it finds. It is a study aid, not clinical advice.",
 "agent-askai":"Ask AI answers any question, even outside your class materials. For answers from what your coach uploaded, use <a href=\"#\" onclick=\"A.spTab('tutor');return false\">Tutor</a>."
};
function ychNote(a){
 if(!a)return "";
 if(a.id==="agent-athlete")return esc(typeof YAT_NOTE!=="undefined"?YAT_NOTE:"Athlete Edge gives food-first guidance. It is not medical advice.");
 if(a.id==="agent-studypals")return 'Tutor answers from your class materials for '+esc(spLabel())+'. For anything else, try <a href="#" onclick="A.spTab(\'askai\');return false">Ask AI</a>.';
 return YCH_NOTES[a.id]||"AI can make mistakes. Check important details.";
}
(function(){var st=document.createElement("style");st.id="ychcss";st.textContent=
 ".ych-note{padding:0 16px 9px;font-size:11px;line-height:1.45;color:var(--tx3);text-align:center}"+
 ".ych-note a{color:inherit;text-decoration:underline}"+
 ".chat .composer{padding-bottom:8px}"+
 ".ych-bar .sqrow{padding:8px 12px;gap:10px}"+
 ".ych-bar .sqlab{flex:none}"+
 ".ych-bar .sqsrc{flex:1 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding-bottom:1px}"+
 ".ych-bar .sqc{flex:none;padding:5px 10px;font-size:12px}"+
 ".ych-filbtn{flex:none;white-space:nowrap}"+
 ".ych-filbtn .badge{margin-left:2px}"+
 ".ych-bar .sqrow2{padding:8px 12px}"+
 "@media(min-width:761px){"+
  "body.ych .content{height:calc(100vh - 56px);height:calc(100dvh - 56px);overflow:auto;padding:14px 22px 0;box-sizing:border-box;display:flex;flex-direction:column}"+
  "body.ych .content>.wrap{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column}"+
  "body.ych .sqview,body.ych .apview{flex:1 1 auto;height:auto;min-height:340px;gap:10px}"+
  "body.ych .apview.apopen{flex:none}"+
  "body.ych .sqview .chat,body.ych .apview .chat{min-height:300px}"+
  "body.ych .chat .hd{padding-top:10px;padding-bottom:10px}"+
  "body.ych .chat .empty{padding:18px}"+
  "body.ych .yfoot{flex:none;margin:0;padding:7px 0 9px;font-size:11px;gap:12px}"+
  "body.ych-sp .content>.wrap>.card:first-child{margin-bottom:10px!important;flex:none}"+
  "body.ych-sp .spbar{padding:9px 12px;align-items:center;flex-wrap:nowrap}"+
  "body.ych-sp .spbar .f>label{display:none}"+
  "body.ych-sp .tabs button{padding-top:8px;padding-bottom:8px}"+
  "body.ych-sp .spchat{flex:1 1 auto;min-height:340px;display:flex;flex-direction:column}"+
  "body.ych-sp .spchat .chat{flex:1 1 auto;height:auto;min-height:300px}"+
 "}"+
 "@media(max-width:760px){.ych-note{padding:0 12px 6px;font-size:10.5px}.ych-bar .sqrow{padding:8px 10px}.ych-bar .sqlab b{display:none}}";
 document.head.appendChild(st);})();

// The disclaimer goes under the message box, inside the chat card.
var ychBaseChatPanel=chatPanel;
chatPanel=function(a){
 var h=ychBaseChatPanel.apply(this,arguments);var note=ychNote(a);
 if(!note||h.slice(-6)!=="</div>")return h;
 return h.slice(0,-6)+'<div class="ych-note">'+note+'</div></div>';
};
// ...and leaves the bars above the chat.
function ychNoTopNote(h){return String(h).replace(/<div class="sqnote[^"]*">[\s\S]*?<\/div>/,"").replace(/<div class="sphint[^"]*">[\s\S]*?<\/div>/,"");}
var ychBaseAthleteBar=athleteBar;
athleteBar=function(){return ychNoTopNote(ychBaseAthleteBar.apply(this,arguments));};
var ychBaseStudyPals=vStudyPals;
vStudyPals=function(){return ychNoTopNote(ychBaseStudyPals.apply(this,arguments));};

// SynthIQ: sources and a Filters button on one line; the filters open underneath when asked for.
function ychFilterCount(){return (S.sq.years!=="any"?1:0)+(S.sq.types!=="any"?1:0)+(String(S.sq.per)!=="5"?1:0)+(S.sq.oa?1:0);}
sqBar=function(){
 var chips=SQ_SOURCES.map(function(x){var on=S.sq.sources.indexOf(x[0])>=0;return '<button type="button" class="sqc'+(on?" on":"")+'" title="'+attr(x[2])+'" onclick="A.sqSrc(\''+x[0]+'\')">'+ic(on?"check":"plus")+'<span>'+esc(x[1])+'</span></button>';}).join("");
 function sel(field,opts){return '<select onchange="A.sqSet(\''+field+'\',this.value)" aria-label="'+attr(field)+'">'+opts.map(function(o){return '<option value="'+attr(o[0])+'"'+(String(S.sq[field])===o[0]?" selected":"")+'>'+esc(o[1])+'</option>';}).join("")+'</select>';}
 var n=ychFilterCount();
 return '<div class="card sqbar ych-bar"><div class="sqrow"><div class="sqlab">'+ic("file")+'<b>Sources</b><span class="badge">'+S.sq.sources.length+'</span></div><div class="sqsrc">'+chips+'</div>'+
  '<button type="button" class="btn xs '+(YCH.fil?"p":"ghost")+' ych-filbtn" aria-expanded="'+(YCH.fil?"true":"false")+'" onclick="A.ychFil()">'+ic("cog")+'Filters'+(n?' <span class="badge">'+n+'</span>':'')+'</button></div>'+
  (YCH.fil?'<div class="sqrow sqrow2"><div class="sqfil">'+sel("years",SQ_YEARS)+sel("types",SQ_TYPES)+sel("per",SQ_PER)+'<label class="sqoa"><input type="checkbox"'+(S.sq.oa?" checked":"")+' onchange="A.sqSet(\'oa\',this.checked)"><span>Free full text only</span></label></div></div>':'')+'</div>';
};
A.ychFil=function(){YCH.fil=!YCH.fil;render();};

// Full-height layout only on the chat views; every other page keeps its normal scrolling.
var ychBaseRender=render;
render=function(){
 var r=ychBaseRender.apply(this,arguments);
 try{var b=document.body;var sp=!!document.querySelector(".content .spchat");
  b.classList.toggle("ych",sp||!!document.querySelector(".content .sqview, .content .apview"));b.classList.toggle("ych-sp",sp);}catch(e){}
 return r;
};
