// Node: Format Reply (Code) — normalises the output from any provider (or the StudyPals workflow), extracts
// action / plan blocks and prepares the run log + daily usage counter.
var bp=$('Build Prompt').first().json;
var rid="req-"+Date.now().toString(36);
if(bp.denied)return [{json:{response:{success:false,requestId:rid,agentId:bp.agentId||null,conversationId:bp.conversationId||null,error:{code:bp.code,message:bp.message}},logSql:"SELECT 1 AS ok",logParams:[]}}];
var item=$input.first().json||{};
var out=String(item.output||item.text||item.answer||(item.body&&item.body.answer)||"").trim();
var err="";
if(item.error){err=(typeof item.error==="string")?item.error:(item.error.message||item.error.description||JSON.stringify(item.error));}
var mode="ok";
if(!out&&err){mode="error";out="**"+bp.modelLabel+"** could not answer this request.\n\n> "+String(err).replace(/\s+/g," ").slice(0,400)+"\n\n"+(bp.provider==="studypals"?"StudyPals did not respond. Check that the StudyPals tutor workflow is active.":"Try another model from the selector, or ask an administrator to check the "+bp.modelLabel+" credential in n8n.");}
if(!out){mode="empty";out="The model returned an empty response. Please try again or pick another model.";}
var actions=[],plan=null;
// Models do not always keep the code fence: accept ```plan / ```action fences and bare "plan" / "action" marker lines,
// then take the balanced JSON object that follows.
function extractBlocks(text,kind,onFound){
 var re=new RegExp("(?:```[ \\t]*"+kind+"[ \\t]*\\n|(?:^|\\n)[ \\t]*"+kind+"[ \\t]*\\n)\\s*\\{","g");var m;
 while((m=re.exec(text))){
  var start=m.index+m[0].length-1;var depth=0,i=start,inStr=false,escp=false;
  for(;i<text.length;i++){var ch=text[i];if(inStr){if(escp)escp=false;else if(ch==="\\")escp=true;else if(ch==='"')inStr=false;continue;}if(ch==='"')inStr=true;else if(ch==="{")depth++;else if(ch==="}"){depth--;if(depth===0)break;}}
  if(depth!==0)break;
  var jsonText=text.slice(start,i+1);var end=i+1;var tail=text.slice(end).match(/^\s*```/);if(tail)end+=tail[0].length;
  try{var obj=JSON.parse(jsonText);onFound(obj);text=text.slice(0,m.index)+"\n"+text.slice(end);re.lastIndex=m.index;}catch(e){re.lastIndex=end;}
 }
 return text;
}
out=extractBlocks(out,"action",function(a){if(a&&a.type)actions.push(a);});
out=extractBlocks(out,"plan",function(q){if(q&&typeof q==="object")plan=q;});
out=out.replace(/\n{3,}/g,"\n\n").trim();
if(bp.context&&bp.context.eventId){actions.forEach(function(a){if(!a.eventId)a.eventId=bp.context.eventId;});}
var cited=[];(bp.sources||[]).forEach(function(s){if(out.indexOf("["+s.marker+"]")>=0)cited.push(s);});
var duration=Date.now()-(bp.startedAt||Date.now());
var response={success:true,requestId:rid,conversationId:bp.conversationId,agentId:bp.agentId,agentName:bp.agentName,mode:mode,model:{id:bp.provider,label:bp.modelLabel,modelId:bp.modelId},message:{role:"assistant",content:out,sources:cited,actions:actions,plan:plan},durationMs:duration,contextError:bp.contextError||null};
var logSql="WITH r AS (INSERT INTO ys_agent_runs (agent_id,owner_id,owner_kind,provider,model,conversation_id,prompt_chars,output_chars,status,error,duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),$11) RETURNING id), u AS (INSERT INTO ys_usage (owner_id,day,messages) VALUES ($2,current_date,1) ON CONFLICT (owner_id,day) DO UPDATE SET messages=ys_usage.messages+1 RETURNING messages) INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) VALUES ($13,'agent','answered','agent',$1,$12,$4,'spark') RETURNING id";
var logParams=[bp.agentId,bp.actor.id,bp.actor.kind,bp.provider,bp.modelId,bp.conversationId,(bp.systemPrompt||"").length+(bp.userPrompt||"").length,out.length,mode,String(err).slice(0,300),duration,bp.actor.name,bp.agentName];
return [{json:{response:response,logSql:logSql,logParams:logParams}}];
