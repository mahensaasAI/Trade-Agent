
function sessions(){var sd=$getWorkflowStaticData('global');if(!sd.sessions)sd.sessions={};return sd.sessions;}
function readToken(j){
 var h=j.headers||{};
 var a=h.authorization||h.Authorization||"";
 if(a.indexOf("Bearer ")===0)return a.slice(7).trim();
 var b=j.body||{};
 return (b.token||"").toString().trim();
}
function authorize(j){
 var t=readToken(j);
 if(!t)return {ok:false,code:"UNAUTHENTICATED",message:"Sign in to access this workspace."};
 var s=sessions()[t];
 if(!s)return {ok:false,code:"INVALID_SESSION",message:"Your session is no longer valid. Please sign in again."};
 if(Date.now()>s.exp){delete sessions()[t];return {ok:false,code:"SESSION_EXPIRED",message:"Your session has expired. Please sign in again."};}
 return {ok:true,user:{id:s.id,name:s.name,email:s.email,role:s.role,initials:s.initials}};
}
function deny(a){return [{json:{success:false,requestId:"req-"+Date.now().toString(36),error:{code:a.code,message:a.message}}}];}

var CORPUS=[
 {documentId:"doc-101",documentName:"RAG_Architecture_Blueprint.pdf",projectId:"proj-northwind",page:14,section:"Retrieval Design",indexedAt:"2026-08-14T15:20:00Z",
  text:"The retrieval layer uses hybrid search: BM25 lexical scoring combined with dense vector similarity, fused with reciprocal rank fusion. Chunk size is 800 tokens with 120 tokens of overlap, which tested best against the evaluation set. Every chunk carries product category, locale and document version as metadata so retrieval can be filtered before ranking."},
 {documentId:"doc-101",documentName:"RAG_Architecture_Blueprint.pdf",projectId:"proj-northwind",page:19,section:"Reranking",indexedAt:"2026-08-14T15:20:00Z",
  text:"A cross-encoder reranker runs over the top 25 candidates and returns the top 6 to the generation step. Reranking added 11 points of answer accuracy on the golden set at a cost of roughly 180 milliseconds per query. Below 12 candidates the reranker provides no measurable benefit."},
 {documentId:"doc-102",documentName:"Evaluation_Framework.docx",projectId:"proj-northwind",page:6,section:"Metrics",indexedAt:"2026-08-13T09:41:00Z",
  text:"Four metrics gate every release: context precision, context recall, answer faithfulness and answer relevance. Faithfulness below 0.85 blocks deployment. The golden set holds 240 question and answer pairs curated with the client subject matter experts and is versioned alongside the prompt templates."},
 {documentId:"doc-103",documentName:"Guardrails_And_Safety_Design.pdf",projectId:"proj-northwind",page:8,section:"Input Guardrails",indexedAt:"2026-08-12T11:02:00Z",
  text:"Input guardrails screen for prompt injection, personal data and out-of-scope intent before the request reaches the model. Output guardrails check for unsupported claims, competitor mentions and pricing statements. Any response failing a guardrail is replaced with a deterministic fallback and logged for review."},
 {documentId:"doc-104",documentName:"Vector_Store_Selection.md",projectId:"proj-northwind",page:3,section:"Decision",indexedAt:"2026-08-10T18:15:00Z",
  text:"pgvector on Cloud SQL was selected over a dedicated vector database because the corpus sits below ten million chunks, the team already operates PostgreSQL, and transactional metadata can be joined directly to embeddings. An HNSW index is used with m set to 16 and ef_construction set to 64."},
 {documentId:"doc-105",documentName:"Clinical_Document_Intelligence_Design.pdf",projectId:"proj-meridian",page:11,section:"Extraction Pipeline",indexedAt:"2026-08-15T13:30:00Z",
  text:"Scanned clinical documents pass through layout-aware OCR before extraction. Structured fields are pulled with a schema-constrained model call and every field carries a confidence score. Anything below 0.9 routes to a human reviewer queue rather than flowing downstream automatically."},
 {documentId:"doc-106",documentName:"PHI_Handling_And_Compliance.docx",projectId:"proj-meridian",page:5,section:"Data Protection",indexedAt:"2026-08-15T13:30:00Z",
  text:"Protected health information is redacted before any text leaves the customer boundary. De-identification runs as a separate service and its output is what gets embedded. Raw documents remain in the encrypted bucket with customer-managed keys and a ninety day retention policy."},
 {documentId:"doc-107",documentName:"MLOps_Deployment_Runbook.docx",projectId:"proj-cascade",page:9,section:"Release Process",indexedAt:"2026-08-09T10:05:00Z",
  text:"Prompt and model changes ship through the same pipeline as code. Every candidate runs against the evaluation suite in staging, and promotion requires no metric regressing more than two percent. Rollback is a config flag pointing at the previous prompt version and takes under a minute."},
 {documentId:"doc-108",documentName:"Agentic_Workflow_Patterns.pdf",projectId:"proj-cascade",page:17,section:"Tool Use",indexedAt:"2026-08-11T14:22:00Z",
  text:"Agents are given narrow tools with explicit schemas rather than broad system access. Any action that writes to a downstream system requires a human approval gate in phase one. Agent runs are capped at eight tool calls, after which the run halts and escalates rather than looping."},
 {documentId:"doc-109",documentName:"Predictive_Logistics_Model_Card.md",projectId:"proj-atlas",page:2,section:"Model Details",indexedAt:"2026-08-08T08:50:00Z",
  text:"The delay prediction model is a gradient boosted ensemble trained on thirty months of shipment history. Features cover route, carrier, seasonality, weather and historic dwell time. Known limitation: performance degrades for lanes with fewer than two hundred historic shipments, which are routed to a rules-based fallback."},
 {documentId:"doc-110",documentName:"Data_Pipeline_Architecture.pdf",projectId:"proj-atlas",page:12,section:"Ingestion",indexedAt:"2026-08-07T12:00:00Z",
  text:"Batch ingestion runs nightly through the warehouse; streaming events arrive on a message bus for near-real-time features. Both paths write to a single feature store so training and serving read identical definitions, which removed the training and serving skew seen in the pilot."},
 {documentId:"doc-111",documentName:"Vision_Inspection_Pilot_Findings.docx",projectId:"proj-vertex",page:7,section:"Results",indexedAt:"2026-08-16T20:30:00Z",
  text:"The pilot reached 96.4 percent defect recall against the labelled validation set with a false positive rate of 3.1 percent. Lighting variation on the second line was the dominant error source. Recommendation is fixed lighting rigs before scaling to the remaining four lines."},
 {documentId:"doc-112",documentName:"AI_Governance_Policy.pdf",projectId:"proj-meridian",page:4,section:"Risk Classification",indexedAt:"2026-08-16T09:15:00Z",
  text:"Each use case is classified by risk tier at intake. High risk cases require documented human oversight, a model card, an evaluation report and a named accountable owner before production. Classification is reviewed every six months or whenever the use case materially changes."},
 {documentId:"doc-113",documentName:"Integration_And_Orchestration_Spec.pdf",projectId:"proj-cascade",page:10,section:"Orchestration",indexedAt:"2026-08-05T16:12:00Z",
  text:"n8n is the orchestration layer between the product surface and AI services, so retrieval, model calls and downstream actions stay outside the application code. Every workflow returns a correlation identifier, and failures land in a central error table with the payload retained for replay."},
 {documentId:"doc-201",documentName:"Proposal_Playbook.docx",projectId:"proj-firm",page:5,section:"Response Structure",indexedAt:"2026-08-16T11:00:00Z",
  text:"Every RFP response follows the same seven sections: executive summary, understanding of requirements, proposed solution, delivery approach and plan, team and governance, commercial model, and assumptions and exclusions. The executive summary is written last and never exceeds one page. Each requirement in the client matrix is answered with a Comply, Partially Comply or Alternative Proposed rating plus a cross reference to the section that evidences it."},
 {documentId:"doc-201",documentName:"Proposal_Playbook.docx",projectId:"proj-firm",page:9,section:"Win Themes",indexedAt:"2026-08-16T11:00:00Z",
  text:"Three standing win themes: measurable evaluation before production, orchestration that keeps AI logic outside application code so it can be changed without redeployment, and governance evidence produced as a by-product of delivery rather than retrofitted. Each theme must be tied to a named client outcome, never asserted on its own."},
 {documentId:"doc-202",documentName:"Rate_Card_And_Commercial_Models.xlsx",projectId:"proj-firm",page:2,section:"Commercial Models",indexedAt:"2026-08-15T09:30:00Z",
  text:"Three commercial models are offered: time and materials for discovery and open-ended research, fixed price for well-defined delivery phases with a signed scope baseline, and outcome-based pricing where a measurable acceptance metric exists. Fixed price requires a completed discovery and a change control clause. Outcome-based engagements require an agreed baseline measurement before work starts."},
 {documentId:"doc-203",documentName:"Past_Performance_Case_Studies.pdf",projectId:"proj-firm",page:12,section:"Reference Engagements",indexedAt:"2026-08-14T16:45:00Z",
  text:"Reference engagements approved for external use: a retail conversational assistant reaching production with a documented evaluation harness, a clinical document extraction platform with confidence-gated human review, and a manufacturing vision pilot achieving 96.4 percent defect recall. Client names may only be used where a written reference agreement is on file; otherwise describe the sector and scale."},
 {documentId:"doc-204",documentName:"Bid_Qualification_Criteria.docx",projectId:"proj-firm",page:3,section:"Go No-Go",indexedAt:"2026-08-13T14:10:00Z",
  text:"Qualify out when there is no named executive sponsor, when the evaluation criteria are price-only, when the incumbent wrote the requirements, or when the timeline gives less than ten working days for a full technical response. Qualify in when discovery is funded, when a measurable success metric already exists, and when the client will give access to subject matter experts during the bid."}
];
function score(q,t){
 var qs=String(q||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>2});
 if(!qs.length)return 0;
 var lt=t.toLowerCase(),hit=0;
 qs.forEach(function(w){if(lt.indexOf(w)>=0)hit++;});
 return hit/qs.length;
}
function retrieve(q,pid,k){
 var pool=CORPUS.filter(function(c){return !pid||c.projectId===pid});
 if(!pool.length)pool=CORPUS;
 var out=pool.map(function(c){return {c:c,s:score(q,c.text+" "+c.documentName+" "+c.section)};})
  .filter(function(r){return r.s>0}).sort(function(a,b){return b.s-a.s}).slice(0,k||5);
 if(!out.length)out=pool.slice(0,Math.min(3,pool.length)).map(function(c){return {c:c,s:0.42}});
 return out.map(function(r){
  return {documentId:r.c.documentId,documentName:r.c.documentName,projectId:r.c.projectId,page:r.c.page,section:r.c.section,
   indexedAt:r.c.indexedAt,excerpt:r.c.text,score:Math.min(0.97,0.55+r.s*0.42)};
 });
}

var j=$('Agent Chat Request').first().json;
var a=authorize(j);
if(!a.ok)return [{json:{denied:true,provider:"denied",code:a.code,message:a.message}}];
var b=j.body||{};
var msg=String(b.message||"").slice(0,6000);
var agentId=b.agentId||"agent-knowledge";
var projectId=b.projectId||null;
var atts=Array.isArray(b.attachments)?b.attachments:[];
var cfg=($input.first().json||{}).d||{};
var plan=String(cfg.plan||"free").toLowerCase();
var MODELS=Array.isArray(cfg.models)?cfg.models:[];
if(!MODELS.length)MODELS=[{id:"claude",name:"Claude",provider:"anthropic",modelId:"claude-sonnet-4-6",tier:"premium"}];
function tierOf(m){return String((m&&m.tier)||"free").toLowerCase()==="premium"?"premium":"free";}
// The picker already hides premium models on a free plan; this repeats the rule server side so a
// crafted request cannot reach a model the organization has not paid for.
var pool=MODELS.filter(function(m){return tierOf(m)==="free"||plan==="premium";});
if(!pool.length)pool=MODELS.slice(0,1);
var reqModel=String(b.model||"").trim().toLowerCase();
var modelSel=null;
for(var mi=0;mi<pool.length;mi++){if(String(pool[mi].id).toLowerCase()===reqModel)modelSel=pool[mi];}
if(!modelSel){
 var prem=pool.filter(function(m){return tierOf(m)==="premium";});
 modelSel=(plan==="premium"&&prem.length)?prem[0]:pool[0];
}
var ROUTE={google:"gemini",gemini:"gemini",groq:"groq",mistral:"mistral",anthropic:"claude",claude:"claude",openai:"chatgpt",chatgpt:"chatgpt"};
var provider=ROUTE[String(modelSel.provider||"").toLowerCase()]||"gemini";
var PERSONAS={
 "agent-architect":{name:"Solution Architect Agent",focus:"AI solution architecture — retrieval design, chunking, reranking, model selection, prompt strategy and system trade-offs."},
 "agent-proposal":{name:"Proposal Builder Agent",focus:"RFP and RFI responses — bid qualification, response structure, compliance matrices, win themes, commercial models and approved past performance."},
 "agent-sql":{name:"Oracle Fusion SQL Agent",focus:"writing and running read-only SQL against Oracle Fusion, then explaining the results."},
 "agent-data":{name:"Data Engineering Agent",focus:"data engineering for AI — ingestion pipelines, embeddings, feature stores, indexing, schema design and data quality."},
 "agent-mlops":{name:"MLOps Agent",focus:"MLOps — release process, evaluation harnesses, regression gates, rollback, monitoring and model cards."},
 "agent-integration":{name:"Integration Agent",focus:"integration and orchestration — API design, n8n workflows, tool schemas, retries, error handling and replay."},
 "agent-governance":{name:"Governance Agent",focus:"AI governance — risk classification, guardrails, data protection, human oversight and audit evidence."},
 "agent-knowledge":{name:"Knowledge Agent",focus:"cross-project retrieval, summarisation and research over the whole engagement knowledge base."}
};
var persona=PERSONAS[agentId]||PERSONAS["agent-knowledge"];
var PROJ={"proj-northwind":"Northwind Retail Group — Conversational Commerce Assistant",
 "proj-meridian":"Meridian Health Network — Clinical Document Intelligence",
 "proj-cascade":"Cascade Financial — Agentic Back-Office Automation",
 "proj-atlas":"Atlas Freight Systems — Predictive Logistics Platform",
 "proj-vertex":"Vertex Manufacturing — Computer Vision Quality Inspection",
 "proj-firm":"OraDayForce — Bid & Proposal Desk"};
var projLabel=PROJ[projectId]||"the current engagement";
var isSql=(agentId==="agent-sql");
var retPid=(agentId==="agent-proposal")?null:projectId;
var hits=isSql?[]:retrieve(msg,retPid,4);
var ctx=hits.map(function(h,i){
 return "[S"+(i+1)+"] "+h.documentName+(h.page?" — page "+h.page:"")+(h.section?", section: "+h.section:"")+"\n"+h.excerpt;
}).join("\n\n");
var attLine=atts.length?("\n\nThe consultant attached these files (metadata only, contents not yet ingested): "+atts.map(function(x){return x.name;}).join(", ")+". Acknowledge them briefly and offer to index them into the project knowledge base."):"";
var sys;
if(isSql){
 sys=[
  "You are the Oracle Fusion SQL Agent inside WorkPlace, the internal AI platform used by OraDayForce.",
  "You answer data questions by writing read-only Oracle SQL and running it with the Oracle Fusion SQL Runner tool, then explaining the results.",
  "The person asking is "+a.user.name+", "+a.user.role+".",
  "",
  "TOOL USE",
  "- The tool takes two arguments: sql (a single read-only SELECT or WITH...SELECT) and instance (dev2 is the default, dev1 is the alternative).",
  "- Use dev2 unless the person explicitly asks for dev1. If they switch instance, keep using it for the rest of the conversation.",
  "- Only SELECT is permitted. Never attempt INSERT, UPDATE, DELETE, MERGE or DDL — the engine rejects them and you must not try.",
  "- Write one statement, no trailing semicolon, no stacked statements. The engine auto-caps results at 500 rows.",
  "- Prefer explicit column lists over SELECT *, and add a WHERE clause or aggregate when the table is large.",
  "- Query Oracle Fusion tables and views such as gl_ledgers, gl_code_combinations, gl_periods, poz_suppliers, ap_invoices_all, ar_cash_receipts_all, hr_all_organization_units. Use standard Oracle syntax.",
  "",
  "ANSWERING",
  "- Show the SQL you ran in a fenced sql code block, then the results as a markdown table.",
  "- If the tool returns success false, show the error plainly and offer a corrected query. Do not retry the same statement.",
  "- If it returns zero rows, say so and suggest how to widen the filter rather than inventing data.",
  "- Never fabricate rows, column names or counts. Every number you state must come from the tool result.",
  "- If the request is not a data question, answer briefly and do not call the tool.",
  attLine
 ].join("\n");
}else{
 var extra="";
 if(agentId==="agent-proposal"){
  extra=["","PROPOSAL RULES",
  "- Follow the seven-section response structure from the playbook unless the client RFP mandates its own.",
  "- For compliance matrices use Comply, Partially Comply or Alternative Proposed, with a cross reference to the section that evidences the claim.",
  "- Tie every win theme to a named client outcome; never assert a theme on its own.",
  "- Only cite reference engagements approved for external use, and only name a client where a reference agreement is on file — otherwise describe sector and scale.",
  "- Never invent pricing, rates, headcount or delivery dates. If a commercial number is needed and not in the retrieved passages, mark it as [TO BE CONFIRMED WITH THE BID LEAD].",
  "- When asked whether to bid, walk the qualification criteria and give a clear go or no-go with reasons."].join("\n");
 }
 sys=[
  "You are the "+persona.name+" inside WorkPlace, the internal AI agent platform used by OraDayForce, an AI development consultancy.",
  "Your specialism is "+persona.focus,
  "You are answering for: "+projLabel+".",
  "The person asking is "+a.user.name+", "+a.user.role+".",
  "You have no tools available. Never attempt to call a tool.",
  "",
  "RETRIEVED KNOWLEDGE (from the pgvector knowledge base):",
  ctx||"(no passages retrieved)",
  "",
  "How to answer:",
  "- Ground your answer in the retrieved passages. Where a statement comes from a passage, append its marker, for example [S1], at the end of that sentence.",
  "- If the passages do not cover the question, say so plainly and answer from general practice, clearly flagged as general guidance.",
  "- Write like a senior consultant briefing a colleague: direct, specific, no filler, no restating the question.",
  "- Use markdown. Prefer short labelled sections, numbered steps for processes, and a markdown table when comparing options.",
  "- Keep it to roughly 200-400 words unless the question genuinely needs more.",
  "- Never invent document names, page numbers, metrics or client data that are not in the retrieved passages.",
  extra,
  attLine
 ].join("\n");
}
return [{json:{denied:false,systemPrompt:sys,userPrompt:msg,sources:hits.map(function(h){
 return {documentId:h.documentId,documentName:h.documentName,projectId:h.projectId,page:h.page,section:h.section};
}),agentId:agentId,projectId:projectId,provider:provider,plan:plan,modelKey:modelSel.id,modelId:modelSel.modelId||modelSel.id,modelLabel:modelSel.name||modelSel.id,conversationId:b.conversationId||("conv-"+Date.now().toString(36)),
 requestId:"req-"+Date.now().toString(36)}}];
