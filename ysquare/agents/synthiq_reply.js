// Node: Format Reply (Code) — normalises the model output, keeps only the citations the answer actually used,
// applies the same output guard as the other agents and prepares the run log + daily usage counter.
var bp=$('Build Prompt').first().json;
var rid="req-"+Date.now().toString(36);
var LOG_SQL="WITH r AS (INSERT INTO ys_agent_runs (agent_id,owner_id,owner_kind,provider,model,conversation_id,prompt_chars,output_chars,status,error,duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),$11) RETURNING id), u AS (INSERT INTO ys_usage (owner_id,day,messages) VALUES ($2,current_date,1) ON CONFLICT (owner_id,day) DO UPDATE SET messages=ys_usage.messages+1 RETURNING messages) INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) VALUES ($13,'agent','answered','agent',$1,$12,$4,'spark') RETURNING id";
if(bp.blocked){
 // Refused by the guardrails: nothing reached a model. Logged as "blocked" so admins can see attempts in Agent runs.
 var bl=[bp.agentId,bp.actor.id,bp.actor.kind,"guard","guardrails",bp.conversationId,String(bp.userPrompt||"").length,0,"blocked","guardrail: "+String(bp.userPrompt||"").slice(0,200),0,bp.actor.name,"Guardrails"];
 return [{json:{response:{success:true,requestId:rid,conversationId:bp.conversationId,agentId:bp.agentId,mode:"blocked",model:{id:"guard",label:"Safety"},message:{role:"assistant",content:bp.message,sources:[],actions:[],plan:null},durationMs:0},logSql:LOG_SQL,logParams:bl}}];
}
if(bp.denied)return [{json:{response:{success:false,requestId:rid,agentId:bp.agentId||null,conversationId:bp.conversationId||null,error:{code:bp.code,message:bp.message}},logSql:"SELECT 1 AS ok",logParams:[]}}];
// ---- Output guard: hide secrets, other people's contact details and ids, internal URLs and any leaked instructions.
var me=bp.actor||{};
function redact(t){
 t=String(t==null?"":t);
 t=t.replace(/[ \t]*\u3010[^\u3011]{0,300}\u3011[ \t]*/g," ");
 t=t.replace(/[ \t]*:contentReference\[oaicite:\d+\]\{index=\d+\}[ \t]*/g," ");
 t=t.replace(/\b(sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})\b/g,"[hidden]");
 t=t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,function(x){return (me.email&&x.toLowerCase()===String(me.email).toLowerCase())?x:"[hidden]";});
 t=t.replace(/(\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,"[hidden]");
 t=t.replace(/\b(user|guest)-[a-z0-9]{6,40}\b/gi,function(x){return x.toLowerCase()===String(me.id).toLowerCase()?"you":"[hidden]";});
 t=t.replace(/\bm-[a-f0-9]{32}\b/g,"[hidden]");
 t=t.replace(/https?:\/\/[^\s)"'<>]*(webhook|n8n|duckdns|localhost|127\.0\.0\.1)[^\s)"'<>]*/gi,"");
 t=t.replace(/\bys_[a-z_]{3,}\b/g,"[hidden]");
 return t;
}
var LEAK_RE=/SECURITY RULES \(highest priority|LIVE DATA:|HOW TO ANSWER:|You have no tools of your own|REMINDER: the SECURITY RULES|SEARCH RUN JUST NOW:/;
var item=$input.first().json||{};
var out=String(item.output||item.text||item.answer||(item.body&&item.body.answer)||"").trim();
var err="";
if(item.error){err=(typeof item.error==="string")?item.error:(item.error.message||item.error.description||JSON.stringify(item.error));}
var mode="ok";
// Never show provider errors to people: the details go to the run log only.
if(!out&&err){mode="error";out="Sorry, I could not answer that just now. Please try again in a moment.";}
if(!out){mode="empty";out="Sorry, I did not get an answer that time. Please try again.";}
// Models sometimes write the markers with fullwidth brackets or group them: normalise to [P1][P2] first.
out=out.replace(/[\u3010]\s*((?:P\d{1,2})(?:\s*[,;\u3001]\s*P\d{1,2})*)\s*[\u3011]/g,function(_,g){return g.split(/[,;\u3001]/).map(function(x){return "["+x.trim()+"]";}).join("");});
out=out.replace(/\[\s*((?:P\d{1,2})(?:\s*[,;]\s*P\d{1,2})+)\s*\]/g,function(_,g){return g.split(/[,;]/).map(function(x){return "["+x.trim()+"]";}).join("");});
var cited=[];(bp.sources||[]).forEach(function(s){if(out.indexOf("["+s.marker+"]")>=0)cited.push(s);});
if(LEAK_RE.test(out)){mode="guarded";out="Sorry, I can't share that. Ask me a research question and I'll help.";cited=[];}
out=redact(out).replace(/\n{3,}/g,"\n\n").trim();
var duration=Date.now()-(bp.startedAt||Date.now());
var response={success:true,requestId:rid,conversationId:bp.conversationId,agentId:bp.agentId,agentName:bp.agentName,mode:mode,model:{id:bp.provider,label:bp.modelLabel},message:{role:"assistant",content:out,sources:cited,actions:[],plan:null},durationMs:duration};
var logParams=[bp.agentId,bp.actor.id,bp.actor.kind,bp.provider,bp.modelId,bp.conversationId,(bp.systemPrompt||"").length+(bp.userPrompt||"").length,out.length,mode,String(err).slice(0,300),duration,bp.actor.name,bp.agentName];
return [{json:{response:response,logSql:LOG_SQL,logParams:logParams}}];
