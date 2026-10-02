// Node: Prepare Search (Code) — identifies the caller (guest id or ys_sessions row), applies the same
// guardrails as the other agents, and sanitises the sources and filters the person picked in the browser.
function readToken(j){var h=j.headers||{};var a=h.authorization||h.Authorization||"";if(a.indexOf("Bearer ")===0)return a.slice(7).trim();return String((j.body||{}).token||"").trim();}
function readGuest(j){var h=j.headers||{};var g=String(h["x-guest-id"]||h["X-Guest-Id"]||(j.body||{}).guestId||"").trim();return /^guest-[a-z0-9]{12,40}$/i.test(g)?g.toLowerCase():"";}
function str(v,max){if(v==null)return null;var x=String(v).trim();if(!x)return null;return max?x.slice(0,max):x;}
var CTRL_RE=new RegExp("["+String.fromCharCode(0)+"-"+String.fromCharCode(8)+String.fromCharCode(11,12)+String.fromCharCode(14)+"-"+String.fromCharCode(31)+String.fromCharCode(127)+String.fromCharCode(8203)+"-"+String.fromCharCode(8207)+String.fromCharCode(8232)+"-"+String.fromCharCode(8239)+String.fromCharCode(8288)+"-"+String.fromCharCode(8303)+String.fromCharCode(65279)+"]","g");
// ---- Guardrails: messages that try to change how the agents work, pull hidden instructions or reach other people's data are refused.
function cleanText(v,max){return String(v==null?"":v).normalize("NFKC").replace(CTRL_RE,"").trim().slice(0,max);}
var GUARD=[
 /\b(ignore|disregard|forget|override|bypass|skip)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the|these|those|system)\b[^.\n]{0,30}\b(instructions?|rules?|prompts?|guidelines?|directions?|restrictions?|polic(y|ies))/i,
 /\b(reveal|show|print|repeat|tell|display|output|leak|give|share|copy|what(?:'s| is| are| were))\b[^.\n]{0,40}\b(system\s*prompt|system\s*message|your\s+(instructions|rules|prompt|guidelines|configuration|settings)|hidden\s+(prompt|instructions|rules|data)|developer\s+(message|prompt)|initial\s+prompt|live\s+data\s+block)/i,
 /\b(jailbreak|developer\s+mode|dan\s+mode|do\s+anything\s+now|god\s+mode|unfiltered\s+mode|sudo\s+mode)\b/i,
 /\b(you\s+are\s+now|from\s+now\s+on\s+you|act\s+as|pretend\s+(to\s+be|you\s+are)|role-?play\s+as)\b[^.\n]{0,50}\b(unrestricted|unfiltered|no\s+rules|without\s+(any\s+)?(rules|restrictions|filters|limits)|evil|hacker|admin(istrator)?|developer|system)\b/i,
 /\b(change|modify|update|rewrite|replace|disable|turn\s+off|remove)\s+(your|the|all)\s+(rules|instructions|system\s*prompt|persona|guardrails?|safety|filters?|settings|model|restrictions)\b/i,
 /\b(other|another|all|every|any)\s+(users?|students?|members?|people'?s?|accounts?|guests?|athletes?|kids?|children|person'?s?)\b[^.\n]{0,40}\b(data|info(rmation)?|details|e-?mails?|phones?|numbers|addresses|profiles?|passwords?|chats?|messages?|history|answers|grades|scores|conversations?|ids?|names)\b/i,
 /\b(e-?mails?|phones?|passwords?|addresses|profiles?|chat\s*history|conversations?|personal\s+(data|info(rmation)?|details))\s+(of|for|from)\s+(other|another|all|every|any)\s+(users?|students?|members?|people|accounts?|guests?)\b/i,
 /\b(api[\s_-]?keys?|secret\s+keys?|access\s+tokens?|bearer\s+tokens?|session\s+tokens?|credentials?|env(ironment)?\s+variables?|webhook\s+urls?|database\s+(password|url|connection))\b[^.\n]{0,30}\b(show|list|dump|give|reveal|print|send|share|what)\b|\b(show|list|dump|give|reveal|print|send|share|what)\b[^.\n]{0,30}\b(api[\s_-]?keys?|secret\s+keys?|access\s+tokens?|bearer\s+tokens?|session\s+tokens?|credentials|env(ironment)?\s+variables?|webhook\s+urls?|database\s+(password|url|connection))\b/i,
 /\bys_[a-z_]{3,}\b|\b(drop|truncate)\s+table\b|\bunion\s+(all\s+)?select\b|;\s*(drop|delete|update|insert)\s/i,
 /<\s*\/?\s*(system|assistant|developer|instructions?|im_start|im_end)\s*>|\[\s*(system|inst)\s*\]|^\s*#{1,6}\s*(system|new\s+instructions)\b|\bbegin\s+(system|new)\s+(prompt|instructions)\b/im,
 /\b(i\s+am|i'm|im|as)\s+(the|an|a|your)?\s*(admin(istrator)?|developer|owner|creator|system|anthropic|openai|n8n)\b[^.\n]{0,60}\b(give|grant|enable|unlock|show|access|override|ignore|switch|let\s+me)\b/i,
 /\b(unlock|bypass|hack|get)\b[^.\n]{0,25}\b(premium|admin)\b[^.\n]{0,25}\b(free|access|without\s+paying|for\s+nothing)\b/i
];
function guardHit(t){if(!t)return false;for(var i=0;i<GUARD.length;i++){if(GUARD[i].test(t))return true;}return false;}
function deny(code,msg){return [{json:{denied:true,provider:"denied",code:code,message:msg,sql:"SELECT 1 AS ok",params:[]}}];}
var j=$('SynthIQ Request').first().json;var b=j.body||{};
var s=($input.first()||{}).json||{};
var t=readToken(j);var guestId=readGuest(j);var actor=null;
if(t){
 if(!s.id)return deny("INVALID_SESSION","Your session is no longer valid or has expired. Please sign in again.");
 if(s.active===false)return deny("ACCOUNT_DISABLED","This account has been deactivated.");
 var eff=(s.plan==="premium"&&(!s.plan_expires_at||new Date(s.plan_expires_at).getTime()>Date.now()))?"premium":"free";
 actor={id:s.id,name:s.name,email:s.email,role:s.role,plan:eff,kind:"member"};
}else if(guestId){actor={id:guestId,name:str(b.guestName,60)||"Guest",email:null,role:"guest",plan:"free",kind:"guest"};}
else return deny("UNAUTHENTICATED","Something went wrong. Please reload the page and try again.");
var msg=cleanText(b.message,600);
if(!msg)return deny("INVALID_REQUEST","Please type a research question first.");
var conversationId=String(b.conversationId||"");if(!/^[a-z0-9][a-z0-9-]{2,60}$/i.test(conversationId))conversationId="conv-"+Date.now().toString(36);
var requestedModel=String(b.model||"").trim().toLowerCase().slice(0,40);
var c=(b.context&&typeof b.context==="object")?b.context:{};
// The browser may only choose from this list; anything else is dropped.
var SRC=["pubmed","pmc","cochrane","trials","preprints","crossref"];
var want=Array.isArray(c.sources)?c.sources:String(c.sources||"").split(",");
var picked=[];want.forEach(function(x){x=String(x||"").trim().toLowerCase();if(SRC.indexOf(x)>=0&&picked.indexOf(x)<0)picked.push(x);});
if(!picked.length)picked=["pubmed","pmc"];
var search={sources:picked.slice(0,6),years:["any","5","10"].indexOf(String(c.years))>=0?String(c.years):"any",types:String(c.types)==="evidence"?"evidence":"any",openAccess:!!Number(c.openAccess),perSource:Math.max(3,Math.min(8,Math.round(Number(c.perSource))||5))};
var blocked=guardHit(msg);
var sql="SELECT json_build_object("+
 "'usage',(SELECT coalesce(messages,0) FROM ys_usage WHERE owner_id=$1 AND day=current_date),"+
 "'limits',(SELECT value FROM ys_settings WHERE key='limits'),"+
 "'organization',(SELECT value FROM ys_settings WHERE key='organization'),"+
 "'agentSetting',(SELECT default_model FROM ys_agent_settings WHERE agent_id='agent-synthiq'),"+
 "'models',(SELECT coalesce(json_agg(m ORDER BY m.sort),'[]'::json) FROM (SELECT id,provider,label,model_id,tier,sort FROM ys_models WHERE enabled) m)"+
 ") AS d";
return [{json:{denied:false,blocked:blocked,task:"chat",agentId:"agent-synthiq",message:msg,conversationId:conversationId,requestedModel:requestedModel,actor:actor,search:search,startedAt:Date.now(),sql:sql,params:[actor.id]}}];
