// Generates dist/workflows/synthiq.sdk.js — the "Y Square SynthIQ" workflow (n8n Workflow SDK code).
// SynthIQ is a separate workflow from Y Square Agents so the literature retrieval cannot affect the
// other three agents. It serves POST /webhook/Y2Workplace/svc/synthiq.
const fs = require("fs");
const path = require("path");
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.stringify(v);
const BASE = "Y2Workplace";
const MODEL_ID = "{{ $('Build Prompt').first().json.modelId }}";
const MEM_KEY = "{{ $('Build Prompt').first().json.memoryKey }}";

const SESSION_SQL = "SELECT s.user_id AS id, u.name, u.email, u.role, u.initials, s.exp, u.active, u.plan, u.plan_expires_at FROM ys_sessions s JOIN ys_users u ON u.id = s.user_id WHERE s.token_hash = md5($1) AND s.exp > now() LIMIT 1";
const SESSION_PARAM = "{{ [ String((($json.headers || {}).authorization || ($json.headers || {}).Authorization || '')).replace(/^Bearer +/i, '').trim() || String((($json.body || {}).token || '')).trim() ] }}";

const rule = (id, value) => ({
  conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
    conditions: [{ id: "prov-" + id, leftValue: "={{ $json.provider }}", rightValue: value, operator: { type: "string", operation: "equals" } }],
    combinator: "and" },
  renameOutput: true, outputKey: value,
});
const ROUTER = { mode: "rules", rules: { values: ["claude", "chatgpt", "gemini", "mistral", "groq", "denied"].map((v) => rule(v, v)) }, options: { fallbackOutput: "none" } };

const memNode = (name, y) => `memory({ type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', version: 1.4, config: { name: ${J(name)}, parameters: { sessionIdType: 'customKey', sessionKey: expr(${J(MEM_KEY)}), contextWindowLength: 10 }, position: [1712, ${y + 200}] } })`;
const agentNode = (name, y, model, mem) => `node({ type: '@n8n/n8n-nodes-langchain.agent', version: 3.1, config: { name: ${J(name)}, parameters: { promptType: 'define', text: expr('{{ $json.userPrompt }}'), options: { systemMessage: expr('{{ $json.systemPrompt }}'), maxIterations: 3, enableStreaming: false } }, subnodes: { model: ${model}, memory: ${mem} }, onError: 'continueRegularOutput', position: [1568, ${y}] }, output: [{ output: 'Answer text' }] })`;

const out = `import { workflow, node, trigger, sticky, expr, newCredential, switchCase, languageModel, memory } from '@n8n/workflow-sdk';

const synthiqRequest = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'SynthIQ Request', parameters: { httpMethod: 'POST', path: ${J(BASE + "/svc/synthiq")}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ headers: {}, body: { agentId: 'agent-synthiq', message: 'What is the evidence for tranexamic acid in major trauma?', model: 'groq', conversationId: 'conv-1', context: { sources: ['pubmed', 'pmc'], years: 'any', types: 'any', openAccess: 0, perSource: 5 } } }] });
const loadSession = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Session', parameters: { operation: 'executeQuery', query: ${J(SESSION_SQL)}, options: { queryReplacement: expr(${J(SESSION_PARAM)}) } }, credentials: { postgres: newCredential('Y Square Postgres') }, alwaysOutputData: true, onError: 'continueRegularOutput', position: [224, 0] }, output: [{ id: 'user-raju', name: 'Raju', plan: 'premium', active: true }] });
const prepareSearch = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Prepare Search', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(R("agents/synthiq_prepare.js"))} }, position: [448, 0] }, output: [{ denied: false, agentId: 'agent-synthiq', message: 'question', search: { sources: ['pubmed'] }, sql: 'SELECT ...', params: ['guest-x'] }] });
const loadContext = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Context', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: { queryReplacement: expr('{{ $json.params }}') } }, credentials: { postgres: newCredential('Y Square Postgres') }, alwaysOutputData: true, onError: 'continueRegularOutput', position: [672, 0] }, output: [{ d: { usage: 3, limits: {}, models: [] } }] });
const fetchPapers = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Fetch Papers', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(R("agents/synthiq_fetch.js"))} }, alwaysOutputData: true, onError: 'continueRegularOutput', position: [896, 0] }, output: [{ d: {}, papers: [{ title: 'A trial', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }], retrieval: { sources: ['PubMed / MEDLINE'], errors: [] } }] });
const buildPrompt = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Build Prompt', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(R("agents/synthiq_prompt.js"))} }, position: [1120, 0] }, output: [{ provider: 'groq', modelId: 'openai/gpt-oss-120b', systemPrompt: '...', userPrompt: 'question', sources: [] }] });
const modelRouter = switchCase({ version: 3.4, config: { name: 'Model Router', parameters: ${J(ROUTER)}, position: [1344, 0] } });
const claudeModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', version: 1.5, config: { name: 'Claude', parameters: { model: { __rl: true, mode: 'id', value: expr(${J(MODEL_ID)}) }, options: { maxTokensToSample: 3000, temperature: 0.2 } }, credentials: { anthropicApi: newCredential('Anthropic') }, position: [1568, -420] } });
const claudeMemory = ${memNode("Memory (Claude)", -620)};
const agentClaude = ${agentNode("Answer via Claude", -620, "claudeModel", "claudeMemory")};
const chatgptModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', version: 1.3, config: { name: 'ChatGPT', parameters: { model: { __rl: true, mode: 'id', value: expr(${J(MODEL_ID)}) }, responsesApiEnabled: false, options: { temperature: 0.2, maxTokens: 3000 } }, credentials: { openAiApi: newCredential('OpenAI') }, position: [1568, -140] } });
const chatgptMemory = ${memNode("Memory (ChatGPT)", -340)};
const agentChatgpt = ${agentNode("Answer via ChatGPT", -340, "chatgptModel", "chatgptMemory")};
const geminiModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.1, config: { name: 'Gemini Flash', parameters: { modelName: expr(${J(MODEL_ID)}), options: { maxOutputTokens: 8000, temperature: 0.2 } }, credentials: { googlePalmApi: newCredential('Google Gemini') }, position: [1568, 140] } });
const geminiMemory = ${memNode("Memory (Gemini)", -60)};
const agentGemini = ${agentNode("Answer via Gemini Flash", -60, "geminiModel", "geminiMemory")};
const mistralModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud', version: 1, config: { name: 'Mistral', parameters: { model: expr(${J(MODEL_ID)}), options: { maxTokens: 3000, temperature: 0.2 } }, credentials: { mistralCloudApi: newCredential('Mistral Cloud') }, position: [1568, 420] } });
const mistralMemory = ${memNode("Memory (Mistral)", 220)};
const agentMistral = ${agentNode("Answer via Mistral", 220, "mistralModel", "mistralMemory")};
const groqModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGroq', version: 1, config: { name: 'Groq', parameters: { model: expr(${J(MODEL_ID)}), options: { maxTokensToSample: 8000, temperature: 0.2 } }, credentials: { groqApi: newCredential('Groq') }, position: [1568, 700] } });
const groqMemory = ${memNode("Memory (Groq)", 500)};
const agentGroq = ${agentNode("Answer via Groq", 500, "groqModel", "groqMemory")};
const formatReply = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Format Reply', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(R("agents/synthiq_reply.js"))} }, position: [1936, 0] }, output: [{ response: { success: true }, logSql: 'WITH r AS ...', logParams: [] }] });
const logRun = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Log Run', parameters: { operation: 'executeQuery', query: expr('{{ $json.logSql }}'), options: { queryReplacement: expr('{{ $json.logParams }}') } }, credentials: { postgres: newCredential('Y Square Postgres') }, alwaysOutputData: true, onError: 'continueRegularOutput', position: [2160, 0] }, output: [{ ok: 1 }] });
const returnReply = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Return Reply', parameters: { respondWith: 'json', responseBody: expr("{{ $('Format Reply').first().json.response }}") }, position: [2384, 0] }, output: [{}] });
const note = sticky(${J("## SynthIQ - evidence search for medical students\nPOST /webhook/" + BASE + "/svc/synthiq with {message, model, conversationId, context:{sources,years,types,openAccess,perSource}} plus X-Guest-Id or a bearer token.\n\nPrepare Search identifies the caller and sanitises the source picks. Fetch Papers queries only the chosen sources - Europe PMC for PubMed/MEDLINE, PubMed Central, Cochrane reviews and preprints, the ClinicalTrials.gov API for registered trials and Crossref for other journals - and keeps at most 14 de-duplicated records. Build Prompt applies the daily limit and the free / premium tiers, then writes the prompt around those records so every claim can be cited as [P1], [P2]. Format Reply keeps only the citations the answer actually used and logs the run into ys_agent_runs / ys_usage / ys_activity, exactly like Y Square Agents.\n\nSeparate from Y Square Agents on purpose: retrieval problems here cannot affect Athlete Edge, StudyPals or Event Planner.")}, { position: [0, -300], width: 620, height: 300, color: 4 });

export default workflow('ysquare-synthiq', 'Y Square SynthIQ')
  .add(synthiqRequest).to(loadSession).to(prepareSearch).to(loadContext).to(fetchPapers).to(buildPrompt).to(modelRouter
    .onCase(0, agentClaude.to(formatReply))
    .onCase(1, agentChatgpt.to(formatReply))
    .onCase(2, agentGemini.to(formatReply))
    .onCase(3, agentMistral.to(formatReply))
    .onCase(4, agentGroq.to(formatReply))
    .onCase(5, formatReply.to(logRun.to(returnReply))));
`;
fs.mkdirSync(path.join(__dirname, "..", "dist", "workflows"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "dist", "workflows", "synthiq.sdk.js"), out);
console.log("dist/workflows/synthiq.sdk.js", out.length, "bytes");
