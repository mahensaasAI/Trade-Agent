// Emits the n8n Workflow SDK code for every Y Square workflow into dist/workflows/*.sdk.js, embedding the Code-node
// bodies from services/, agents/ and db/ so those files stay the single source of truth.
// Usage: node workflows/gen_workflows.js   (then validate/create each file through the n8n MCP or paste into n8n)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const keys = JSON.parse(read("workflows/keys.sha256.json"));
const BASE = "Y2Workplace";
const J = (s) => JSON.stringify(s);
const IMPORT = "import { workflow, node, trigger, sticky, expr, newCredential, ifElse, switchCase, languageModel, memory } from '@n8n/workflow-sdk';\n";
const PG = "credentials: { postgres: newCredential('Y Square Postgres') }";
const out = {};

// ---------------------------------------------------------------------------------------------------------- UI
const preparePage = `const first = $input.all()[0];
const row = first ? first.json : {};
const deployed = row && typeof row.html === 'string' && row.html.length > 100;
const fallback = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Y Square Workplace</title></head><body style="font-family:Inter,Segoe UI,sans-serif;padding:48px;color:#0d1220"><h1>Y Square UI is not deployed yet</h1><p>The page is served from the ys_ui_pages table. Run <code>npm run deploy:ui</code> from the ysquare project with YSQUARE_DEPLOY_KEY set to publish it.</p></body></html>';
return [{ json: { html: deployed ? row.html : fallback } }];`;
const checkDeployKey = `// Only the SHA-256 of the deploy key is stored here; the key itself stays with the deployer (workflows/deploy_ui.js).
const KEY_HASH = ${J(keys.deployKeySha256)};
const it = $input.first().json;
const body = it.body || {};
const ok = typeof it.keyHash === 'string' && it.keyHash.length === 64 && it.keyHash === KEY_HASH;
if (!ok) return [{ json: { denied: true, status: 401, sql: 'SELECT 0 AS bytes', params: [], response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid deploy key.' } } } }];
const page = String(body.page || 'ysquare');
const html = typeof body.html === 'string' ? body.html : '';
if (!/^[a-z0-9-]{1,40}$/.test(page) || html.length < 100 || html.length > 4000000) return [{ json: { denied: true, status: 400, sql: 'SELECT 0 AS bytes', params: [], response: { success: false, error: { code: 'BAD_REQUEST', message: 'Body must contain page (slug) and html (100 chars to 4 MB).' } } } }];
return [{ json: { denied: false, status: 200, page, sql: 'INSERT INTO ys_ui_pages (page, html, updated_at, updated_by) VALUES ($1, $2, now(), $3) ON CONFLICT (page) DO UPDATE SET html = EXCLUDED.html, updated_at = now(), updated_by = EXCLUDED.updated_by RETURNING page, length(html) AS bytes, updated_at', params: [page, html, String(body.by || 'deploy_ui.js')], response: null } }];`;
const deployResult = `const chk = $('Check Deploy Key').first().json;
if (chk.denied) return [{ json: { status: chk.status, body: chk.response } }];
const first = $input.all()[0];
const row = first ? first.json : {};
if (row.error || !row.page) return [{ json: { status: 500, body: { success: false, error: { code: 'DB_ERROR', message: String((row.error && row.error.message) || row.error || 'Save failed') } } } }];
return [{ json: { status: 200, body: { success: true, data: { page: row.page, bytes: Number(row.bytes), updatedAt: row.updated_at } } } }];`;
out["ui"] = IMPORT + `
const openPage = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Open Y Square', parameters: { httpMethod: 'GET', path: ${J(BASE)}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ headers: {}, query: {}, body: {} }] });
const loadPage = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Page', parameters: { operation: 'executeQuery', query: "SELECT html FROM ys_ui_pages WHERE page = 'ysquare'", options: {} }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [224, 0] }, output: [{ html: '<!DOCTYPE html><html>...</html>' }] });
const preparePage = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Prepare Page', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(preparePage)} }, position: [448, 0] }, output: [{ html: '<!DOCTYPE html><html>...</html>' }] });
const servePage = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Serve Y Square App', parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Content-Type-Options', value: 'nosniff' }] } } }, position: [672, 0] }, output: [{}] });
const deployRequest = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Deploy Request', parameters: { httpMethod: 'POST', path: ${J(BASE + "/deploy-ui")}, responseMode: 'responseNode' }, position: [0, 260] }, output: [{ headers: { 'x-deploy-key': 'secret' }, body: { page: 'ysquare', html: '<!DOCTYPE html>...' } }] });
const hashDeployKey = node({ type: 'n8n-nodes-base.crypto', version: 2, config: { name: 'Hash Deploy Key', parameters: { action: 'hash', type: 'SHA256', value: expr("{{ String((($json.headers || {})['x-deploy-key']) || '') }}"), dataPropertyName: 'keyHash', encoding: 'hex' }, position: [224, 260] }, output: [{ keyHash: 'abc', body: { page: 'ysquare', html: '...' } }] });
const checkDeployKey = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Check Deploy Key', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(checkDeployKey)} }, position: [448, 260] }, output: [{ denied: false, status: 200, page: 'ysquare', sql: 'INSERT ...', params: [] }] });
const ensureTable = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Ensure Table', parameters: { operation: 'executeQuery', query: 'CREATE TABLE IF NOT EXISTS ys_ui_pages (page text PRIMARY KEY, html text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text)', options: {} }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [672, 260] }, output: [{}] });
const savePage = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Save Page', parameters: { operation: 'executeQuery', query: expr("{{ $('Check Deploy Key').first().json.sql }}"), options: { queryReplacement: expr("{{ $('Check Deploy Key').first().json.params }}") } }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [896, 260] }, output: [{ page: 'ysquare', bytes: 120000, updated_at: '2026-01-01T00:00:00Z' }] });
const deployResult = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Deploy Result', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(deployResult)} }, position: [1120, 260] }, output: [{ status: 200, body: { success: true } }] });
const deployResponse = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Deploy Response', parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.status }}') } }, position: [1344, 260] }, output: [{}] });
const note = sticky(${J("## Y Square UI\nGET /webhook/" + BASE + " serves the Y Square Workplace single-page app (vanilla JS, no build step, same pattern as Neon Logistics UI). The HTML is read from the ys_ui_pages table so the page never has to live inside the workflow.\n\nPOST /webhook/" + BASE + "/deploy-ui with header X-Deploy-Key upserts a new page version. Only the SHA-256 of the key is stored in Check Deploy Key; the key stays with the deployer (npm run deploy:ui in the ysquare project).\n\nAll app data comes from Y Square Services (/svc/api) and Y Square Agents (/svc/chat). Guests are identified by an X-Guest-Id header, members by a bearer token.\n\nSource of truth for the page: ysquare/ui/*, assembled by workflows/gen_ui.js.")}, [ensureTable, savePage], { color: 4 });
export default workflow('ysquare-ui', 'Y Square UI')
  .add(openPage).to(loadPage).to(preparePage).to(servePage)
  .add(deployRequest).to(hashDeployKey).to(checkDeployKey).to(ensureTable).to(savePage).to(deployResult).to(deployResponse);
`;

// ---------------------------------------------------------------------------------------------------- SERVICES
const SESSION_SQL = "SELECT s.user_id AS id, s.name, s.email, s.role, s.initials, s.exp, u.active, u.plan, u.plan_expires_at FROM ys_sessions s JOIN ys_users u ON u.id = s.user_id WHERE s.token_hash = md5($1) AND s.exp > now() LIMIT 1";
const TOKEN_EXPR = "{{ [ String((($json.headers || {}).authorization || ($json.headers || {}).Authorization || '')).replace(/^Bearer +/i, '').trim() || String((($json.body || {}).token || '')).trim() ] }}";
out["services"] = IMPORT + `
const apiRequest = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'API Request', parameters: { httpMethod: 'POST', path: ${J(BASE + "/svc/api")}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ headers: { authorization: 'Bearer token', 'x-guest-id': 'guest-abc123' }, body: { action: 'bootstrap', payload: {} } }] });
const hashPassword = node({ type: 'n8n-nodes-base.crypto', version: 2, config: { name: 'Hash Password', parameters: { action: 'hash', type: 'SHA256', value: expr("{{ String(((($json.body || {}).payload) || {}).password || '') + ':' + String(((($json.body || {}).payload) || {}).email || '').toLowerCase().trim() }}"), dataPropertyName: 'passwordHash', encoding: 'hex' }, position: [224, 0] }, output: [{ passwordHash: 'abc', headers: {}, body: { action: 'bootstrap', payload: {} } }] });
const loadSession = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Session', parameters: { operation: 'executeQuery', query: ${J(SESSION_SQL)}, options: { queryReplacement: expr(${J(TOKEN_EXPR)}) } }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [448, 0] }, output: [{ id: 'user-1', name: 'Raju', email: 'raju@example.com', role: 'admin', plan: 'premium', active: true }] });
const isGoogle = ifElse({ version: 2.3, config: { name: 'Is Google Sign-In?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'is-google', leftValue: expr("{{ $('API Request').item.json.body.action }}"), rightValue: 'login.google', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} }, position: [672, 0] } });
const verifyGoogle = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Verify Google ID Token', parameters: { method: 'GET', url: 'https://oauth2.googleapis.com/tokeninfo', sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [{ name: 'id_token', value: expr("{{ String(((($('API Request').item.json.body || {}).payload) || {}).idToken || '') }}") }] }, options: { timeout: 15000 } }, onError: 'continueRegularOutput', position: [896, -160] }, output: [{ sub: '1234567890', email: 'user@gmail.com', email_verified: 'true', name: 'User', picture: 'https://...', aud: 'client-id.apps.googleusercontent.com' }] });
const routeRequest = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Route Request', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(read("services/route_request.js"))} }, position: [1120, 0] }, output: [{ denied: false, action: 'bootstrap', requestId: 'req-1', actor: { id: 'guest-abc123', kind: 'guest' }, sql: 'SELECT ys_bootstrap($1) AS d', params: ['guest-abc123'], meta: {} }] });
const runQuery = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Run Query', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: { queryReplacement: expr('{{ $json.params }}') } }, ${PG}, onError: 'continueRegularOutput', position: [1344, 0] }, output: [{ d: { models: [], events: [] } }] });
const formatResponse = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Format Response', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(read("services/format_response.js"))} }, position: [1568, 0] }, output: [{ response: { success: true, requestId: 'req-1', data: {} }, sessionSql: 'SELECT 1 AS ok', sessionParams: [] }] });
const persistSession = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Persist Session', parameters: { operation: 'executeQuery', query: expr('{{ $json.sessionSql }}'), options: { queryReplacement: expr('{{ $json.sessionParams }}') } }, ${PG}, onError: 'continueRegularOutput', position: [1792, 0] }, output: [{ ok: 1 }] });
const returnResponse = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Return Response', parameters: { respondWith: 'json', responseBody: expr("{{ $('Format Response').first().json.response }}") }, position: [2016, 0] }, output: [{}] });
const note = sticky(${J("## API - one endpoint, many actions\nPOST /webhook/" + BASE + "/svc/api with {action, payload}. Callers are guests (X-Guest-Id header, no sign-up) or members (bearer token from signup / login / login.google, 24 h sessions in ys_sessions). Route Request enforces the permission level per action (guest < member < premium < admin) and builds ONE parameterised SQL statement ($1..$n, never string concatenation of user input); Run Query executes it; Format Response wraps the envelope and creates sessions.\n\nGoogle sign-in: the IF node sends login.google through Verify Google ID Token (Google tokeninfo endpoint); the client id in ys_settings.auth must match the token audience.\n\nBootstrap, event detail and the admin overview are Postgres functions from ysquare/db/functions.sql, applied by 'Y Square - DB Functions'. Chat lives in 'Y Square Agents'. Sources: ysquare/services/*.js, assembled by workflows/gen_workflows.js.")}, [routeRequest, runQuery, formatResponse], { color: 4 });
export default workflow('ysquare-services', 'Y Square Services')
  .add(apiRequest).to(hashPassword).to(loadSession).to(isGoogle
    .onTrue(verifyGoogle.to(routeRequest))
    .onFalse(routeRequest.to(runQuery.to(formatResponse.to(persistSession.to(returnResponse))))));
`;

// ------------------------------------------------------------------------------------------------------ AGENTS
const MODEL_ID = "{{ $('Build Prompt').first().json.modelId }}";
const CONV_ID = "{{ $('Build Prompt').first().json.conversationId }}";
const rule = (id, key) => `{ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'prov-${key}', leftValue: expr('{{ $json.provider }}'), rightValue: '${key}', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: '${key}' }`;
const agentNode = (name, modelVar, memVar, y) => `node({ type: '@n8n/n8n-nodes-langchain.agent', version: 3.1, config: { name: ${J(name)}, parameters: { promptType: 'define', text: expr('{{ $json.userPrompt }}'), options: { systemMessage: expr('{{ $json.systemPrompt }}'), maxIterations: 3, enableStreaming: false } }, subnodes: { model: ${modelVar}, memory: ${memVar} }, onError: 'continueRegularOutput', position: [1568, ${y}] }, output: [{ output: 'Answer text' }] })`;
const memNode = (name, y) => `memory({ type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', version: 1.4, config: { name: ${J(name)}, parameters: { sessionIdType: 'customKey', sessionKey: expr(${J(CONV_ID)}), contextWindowLength: 10 }, position: [1680, ${y + 180}] } })`;
out["agents"] = IMPORT + `
const chatRequest = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Chat Request', parameters: { httpMethod: 'POST', path: ${J(BASE + "/svc/chat")}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ headers: { 'x-guest-id': 'guest-abc123' }, body: { agentId: 'agent-athlete', message: 'What should I eat before a match?', model: 'gemini', conversationId: 'conv-1', context: {} } }] });
const loadSession = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Session', parameters: { operation: 'executeQuery', query: ${J(SESSION_SQL)}, options: { queryReplacement: expr(${J(TOKEN_EXPR)}) } }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [224, 0] }, output: [{ id: 'user-1', name: 'Raju', email: 'raju@example.com', role: 'admin', plan: 'premium', active: true }] });
const prepareChat = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Prepare Chat', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(read("agents/prepare_chat.js"))} }, position: [448, 0] }, output: [{ denied: false, agentId: 'agent-athlete', message: 'What should I eat?', conversationId: 'conv-1', requestedModel: 'gemini', actor: { id: 'guest-abc123', kind: 'guest', plan: 'free' }, sql: 'SELECT 1', params: [] }] });
const loadChatContext = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Load Chat Context', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: { queryReplacement: expr('{{ $json.params }}') } }, ${PG}, onError: 'continueRegularOutput', position: [672, 0] }, output: [{ d: { profile: null, knowledge: [], models: [] } }] });
const buildPrompt = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Build Prompt', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(read("agents/build_prompt.js"))} }, position: [896, 0] }, output: [{ provider: 'gemini', modelId: 'models/gemini-2.5-flash', modelLabel: 'Gemini Flash', systemPrompt: 'You are Athlete Edge...', userPrompt: 'What should I eat?', conversationId: 'conv-1', agentId: 'agent-athlete', agentName: 'Athlete Edge', actor: { id: 'guest-abc123', kind: 'guest' }, sources: [], startedAt: 0, studypalsUrl: '', studypalsBody: {} }] });
const modelRouter = switchCase({ version: 3.4, config: { name: 'Model Router', parameters: { mode: 'rules', rules: { values: [${rule(0,"claude")}, ${rule(1,"chatgpt")}, ${rule(2,"gemini")}, ${rule(3,"mistral")}, ${rule(4,"groq")}, ${rule(5,"studypals")}, ${rule(6,"denied")}] }, options: { fallbackOutput: 'none' } }, position: [1120, 0] } });
const claudeModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', version: 1.5, config: { name: 'Claude', parameters: { model: { __rl: true, mode: 'id', value: expr(${J(MODEL_ID)}) }, options: { maxTokensToSample: 2000, temperature: 0.3 } }, credentials: { anthropicApi: newCredential('Anthropic') }, position: [1568, -560] } });
const claudeMemory = ${memNode("Memory (Claude)", -740)};
const agentClaude = ${agentNode("Agent via Claude", "claudeModel", "claudeMemory", -740)};
const chatgptModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', version: 1.3, config: { name: 'ChatGPT', parameters: { model: { __rl: true, mode: 'id', value: expr(${J(MODEL_ID)}) }, responsesApiEnabled: false, options: { temperature: 0.3, maxTokens: 2000 } }, credentials: { openAiApi: newCredential('OpenAI') }, position: [1568, -280] } });
const chatgptMemory = ${memNode("Memory (ChatGPT)", -460)};
const agentChatgpt = ${agentNode("Agent via ChatGPT", "chatgptModel", "chatgptMemory", -460)};
const geminiModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.1, config: { name: 'Gemini Flash', parameters: { modelName: expr(${J(MODEL_ID)}), options: { maxOutputTokens: 8000, temperature: 0.3 } }, credentials: { googlePalmApi: newCredential('Google Gemini') }, position: [1568, 0] } });
const geminiMemory = ${memNode("Memory (Gemini)", -180)};
const agentGemini = ${agentNode("Agent via Gemini Flash", "geminiModel", "geminiMemory", -180)};
const mistralModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud', version: 1, config: { name: 'Mistral', parameters: { model: expr(${J(MODEL_ID)}), options: { maxTokens: 2000, temperature: 0.3 } }, credentials: { mistralCloudApi: newCredential('Mistral Cloud') }, position: [1568, 280] } });
const mistralMemory = ${memNode("Memory (Mistral)", 100)};
const agentMistral = ${agentNode("Agent via Mistral", "mistralModel", "mistralMemory", 100)};
const groqModel = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGroq', version: 1, config: { name: 'Groq', parameters: { model: expr(${J(MODEL_ID)}), options: { maxTokensToSample: 8000, temperature: 0.3 } }, credentials: { groqApi: newCredential('Groq') }, position: [1568, 560] } });
const groqMemory = ${memNode("Memory (Groq)", 380)};
const agentGroq = ${agentNode("Agent via Groq", "groqModel", "groqMemory", 380)};
const askStudyPals = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Ask StudyPals Tutor', parameters: { method: 'POST', url: expr('{{ $json.studypalsUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.studypalsBody) }}'), options: { timeout: 120000 } }, onError: 'continueRegularOutput', position: [1568, 660] }, output: [{ answer: 'Tutor reply' }] });
const formatReply = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Format Reply', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(read("agents/format_reply.js"))} }, position: [2016, 0] }, output: [{ response: { success: true, message: { role: 'assistant', content: 'Answer' } }, logSql: 'SELECT 1 AS ok', logParams: [] }] });
const logAgentRun = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Log Agent Run', parameters: { operation: 'executeQuery', query: expr('{{ $json.logSql }}'), options: { queryReplacement: expr('{{ $json.logParams }}') } }, ${PG}, onError: 'continueRegularOutput', position: [2240, 0] }, output: [{ id: 'run-1' }] });
const returnChatReply = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Return Chat Reply', parameters: { respondWith: 'json', responseBody: expr("{{ $('Format Reply').first().json.response }}") }, position: [2464, 0] }, output: [{}] });
const note = sticky(${J("## Chat - Model Router\nPOST /webhook/" + BASE + "/svc/chat with {agentId, message, model, conversationId, context} plus X-Guest-Id or a bearer token. Prepare Chat identifies the caller and loads the live context in one query (athlete profile, knowledge passages, event detail, usage, models). Build Prompt applies daily limits and the free / premium tiers (guests and free members may use Gemini Flash, Mistral and Groq; Claude and ChatGPT need a Premium account), applies the agent persona and picks the provider (request > agent default > gemini). The Switch routes to the agent bound to that provider; StudyPals is proxied to the existing StudyPals tutor workflow (ys_settings.studypals). Add a model = add a row in ys_models + one branch here. Agents never call tools: task lists and announcements come back as action blocks the UI confirms through the API.")}, [buildPrompt, modelRouter], { color: 4 });
export default workflow('ysquare-agents', 'Y Square Agents')
  .add(chatRequest).to(loadSession).to(prepareChat).to(loadChatContext).to(buildPrompt).to(modelRouter
    .onCase(0, agentClaude.to(formatReply))
    .onCase(1, agentChatgpt.to(formatReply))
    .onCase(2, agentGemini.to(formatReply))
    .onCase(3, agentMistral.to(formatReply))
    .onCase(4, agentGroq.to(formatReply))
    .onCase(5, askStudyPals.to(formatReply))
    .onCase(6, formatReply.to(logAgentRun.to(returnChatReply))));
`;

// ------------------------------------------------------------------------------------------------ DB MIGRATION
const schemaCode = `var SQL = ${J(read("db/schema.sql"))};\nreturn [{ json: { sql: SQL, statements: SQL.split(';').length - 1 } }];`;
const seedCode = `var SQL = ${J(read("db/seed.sql"))};\nreturn [{ json: { sql: SQL } }];`;
out["db_migration"] = IMPORT + `
const runMigration = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run Migration', position: [0, 0] }, output: [{}] });
const buildSchema = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Build Schema DDL', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(schemaCode)} }, position: [224, 0] }, output: [{ sql: 'CREATE TABLE ...', statements: 20 }] });
const applySchema = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Apply Schema', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: {} }, ${PG}, position: [448, 0] }, output: [{}] });
const buildSeed = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Build Seed SQL', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(seedCode)} }, position: [672, 0] }, output: [{ sql: 'INSERT INTO ...' }] });
const seedData = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Seed Reference Data', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: {} }, ${PG}, position: [896, 0] }, output: [{}] });
const verify = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Verify', parameters: { operation: 'executeQuery', query: "SELECT (SELECT count(*) FROM ys_users) AS users, (SELECT count(*) FROM ys_models) AS models, (SELECT count(*) FROM ys_agent_settings) AS agent_settings, (SELECT count(*) FROM ys_settings) AS settings, (SELECT count(*) FROM ys_knowledge) AS knowledge_docs, (SELECT count(*) FROM ys_events) AS events, (SELECT count(*) FROM ys_event_tasks) AS tasks, (SELECT count(*) FROM ys_event_updates) AS updates", options: {} }, ${PG}, position: [1120, 0] }, output: [{ users: 1, models: 5, knowledge_docs: 17 }] });
const note = sticky(${J("## One-off migration - safe to re-run\nCreates the ys_* tables for Y Square Workplace (users, sessions, guests, usage, models, agent settings, settings, knowledge, athlete profiles, events, members, tasks, updates, messages, activity, agent runs, billing events, ui pages) and seeds the models (free: Gemini Flash, Mistral, Groq; premium: Claude, ChatGPT), agent defaults, settings, the Athlete Edge and Event Planner knowledge base and a sample event.\n\nAdmin: raju@oradayforce.com (same password as WorkPlace / Neon Logistics, Premium). Passwords are stored as SHA-256(password:email) only.\n\nEvery statement is IF NOT EXISTS / ON CONFLICT / WHERE NOT EXISTS. Source: ysquare/db/schema.sql and seed.sql. Run 'Y Square - DB Functions' afterwards.")}, [buildSchema, applySchema, buildSeed], { color: 4 });
export default workflow('ysquare-db-migration', 'Y Square - DB Migration')
  .add(runMigration).to(buildSchema).to(applySchema).to(buildSeed).to(seedData).to(verify);
`;

// ------------------------------------------------------------------------------------------------- DB FUNCTIONS
const functionsCode = `var SQL = ${J(read("db/functions.sql"))};\nvar S = SQL.split(/\\n-- @@\\n/).map(function (s) { return s.trim(); }).filter(Boolean);\nreturn S.map(function (s, i) { return { json: { seq: i + 1, label: (s.match(/FUNCTION\\s+([a-z_]+)/) || [])[1] || ('statement ' + (i + 1)), sql: s } }; });`;
const summaryCode = `var items = $input.all(); var errs = items.filter(function (i) { return i.json && (i.json.error || i.json.message); });\nreturn [{ json: { applied: items.length - errs.length, failed: errs.length, errors: errs.map(function (i) { var e = i.json.error || {}; return { message: String(i.json.message || e.message || e.description || JSON.stringify(e)), query: String(e.description || '').slice(0, 200) }; }) } }];`;
out["db_functions"] = IMPORT + `
const applyFunctions = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Apply Functions', position: [0, 0] }, output: [{}] });
const listStatements = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'List Statements', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(functionsCode)} }, position: [224, 0] }, output: [{ seq: 1, label: 'ys_bootstrap', sql: 'CREATE OR REPLACE FUNCTION ...' }] });
const applyStatement = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Apply Statement', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: {} }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [448, 0] }, output: [{}] });
const summary = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Summary', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(summaryCode)} }, position: [672, 0] }, output: [{ applied: 4, failed: 0, errors: [] }] });
const note = sticky(${J("## Y Square - DB Functions\nApplies ysquare/db/functions.sql (ys_effective_plan, ys_bootstrap, ys_event_detail, ys_admin_overview) with CREATE OR REPLACE, so it is safe to run again after editing the SQL. Regenerate with workflows/gen_workflows.js, update this workflow and run it manually after the DB Migration.\n\nThe Services API calls these functions (SELECT ys_bootstrap($1) AS d) which keeps the Route Request Code node small.")}, [listStatements, applyStatement], { color: 4 });
export default workflow('ysquare-db-functions', 'Y Square - DB Functions')
  .add(applyFunctions).to(listStatements).to(applyStatement).to(summary);
`;

// ------------------------------------------------------------------------------------------------------ BILLING
const parseBilling = `// Stripe (or any provider) posts here with ?key=... ; only the SHA-256 of the key is stored in this node.
const KEY_HASH = ${J(keys.billingKeySha256)};
const it = $input.first().json;
const ok = typeof it.keyHash === 'string' && it.keyHash === KEY_HASH;
const noop = { sql: 'SELECT 0 AS recorded', params: [] };
if (!ok) return [{ json: Object.assign({ denied: true, status: 401, response: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid billing key.' } } }, noop) }];
const ev = it.body || {};
const obj = (ev.data && ev.data.object) || {};
const type = String(ev.type || '');
const email = String((obj.customer_details && obj.customer_details.email) || obj.customer_email || (obj.metadata && obj.metadata.email) || '').toLowerCase().trim();
const userId = String(obj.client_reference_id || (obj.metadata && obj.metadata.userId) || '').trim();
const amount = obj.amount_total != null ? Number(obj.amount_total) / 100 : (obj.amount_paid != null ? Number(obj.amount_paid) / 100 : null);
const currency = obj.currency ? String(obj.currency).toUpperCase() : null;
let op = 'record';
if ((type === 'checkout.session.completed' && (obj.payment_status === 'paid' || obj.payment_status == null)) || type === 'invoice.paid' || type === 'invoice.payment_succeeded') op = 'activate';
if (type === 'customer.subscription.deleted') op = 'cancel';
if (!email && !userId) op = 'record';
const id = String(ev.id || ('evt-' + Date.now().toString(36)));
const sql = "WITH ev AS (INSERT INTO ys_billing_events (id,provider,type,email,user_id,amount,currency,raw) VALUES ($1,'stripe',$2,NULLIF($3,''),NULLIF($4,''),$5::numeric,$6,$7::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id), u AS (UPDATE ys_users SET plan=CASE WHEN $8='activate' THEN 'premium' WHEN $8='cancel' THEN 'free' ELSE plan END, plan_source='stripe', plan_expires_at=CASE WHEN $8='activate' THEN now()+interval '1 month 3 days' WHEN $8='cancel' THEN NULL ELSE plan_expires_at END, updated_at=now() WHERE $8<>'record' AND (($4<>'' AND id=$4) OR ($4='' AND $3<>'' AND lower(email)=$3)) RETURNING id,email,plan,plan_expires_at), act AS (INSERT INTO ys_activity (actor,actor_type,action,object_type,object_id,target,new_value,icon) SELECT 'Stripe','system','billing '||$2,'user',u.id,u.email,u.plan,'star' FROM u RETURNING id) SELECT json_build_object('recorded',(SELECT count(*) FROM ev),'op',$8,'users',(SELECT coalesce(json_agg(u),'[]'::json) FROM u)) AS d";
return [{ json: { denied: false, status: 200, type, op, email, userId, sql, params: [id, type, email, userId, amount, currency, JSON.stringify(ev).slice(0, 20000), op] } }];`;
const billingResult = `const p = $('Parse Billing Event').first().json;
if (p.denied) return [{ json: { status: p.status, body: p.response } }];
const row = ($input.all()[0] || {}).json || {};
if (row.error) return [{ json: { status: 500, body: { success: false, error: { code: 'DB_ERROR', message: String((row.error && row.error.message) || row.error) } } } }];
return [{ json: { status: 200, body: { success: true, data: Object.assign({ type: p.type, op: p.op }, row.d || {}) } } }];`;
out["billing"] = IMPORT + `
const billingWebhook = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Billing Webhook', parameters: { httpMethod: 'POST', path: ${J(BASE + "/billing/stripe")}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ query: { key: 'secret' }, body: { id: 'evt_1', type: 'checkout.session.completed', data: { object: { customer_details: { email: 'user@example.com' }, client_reference_id: 'user-abc', amount_total: 900, currency: 'usd', payment_status: 'paid' } } } }] });
const hashBillingKey = node({ type: 'n8n-nodes-base.crypto', version: 2, config: { name: 'Hash Billing Key', parameters: { action: 'hash', type: 'SHA256', value: expr("{{ String((($json.query || {}).key) || (($json.headers || {})['x-billing-key']) || '') }}"), dataPropertyName: 'keyHash', encoding: 'hex' }, position: [224, 0] }, output: [{ keyHash: 'abc', body: {} }] });
const parseBilling = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Parse Billing Event', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(parseBilling)} }, position: [448, 0] }, output: [{ denied: false, status: 200, type: 'checkout.session.completed', op: 'activate', sql: 'WITH ...', params: [] }] });
const applyPlan = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Apply Plan', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}'), options: { queryReplacement: expr('{{ $json.params }}') } }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [672, 0] }, output: [{ d: { recorded: 1, users: [] } }] });
const billingResult = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Billing Result', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(billingResult)} }, position: [896, 0] }, output: [{ status: 200, body: { success: true } }] });
const billingResponse = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Billing Response', parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.status }}') } }, position: [1120, 0] }, output: [{}] });
const note = sticky(${J("## Y Square Billing\nPOST /webhook/" + BASE + "/billing/stripe?key=... receives payment provider events (Stripe Payment Link / Checkout). checkout.session.completed and invoice.paid activate Premium for one month (+3 days grace) on the user matched by client_reference_id (the Y Square user id the app passes to the payment link) or by email; customer.subscription.deleted sets the plan back to free. Every event is kept in ys_billing_events.\n\nThe URL key is the second secret of the ysquare project; only its SHA-256 lives in Parse Billing Event. For production also verify the Stripe-Signature header. Admins can set plans manually in the app (Admin > Users).")}, [parseBilling, applyPlan], { color: 4 });
export default workflow('ysquare-billing', 'Y Square Billing')
  .add(billingWebhook).to(hashBillingKey).to(parseBilling).to(applyPlan).to(billingResult).to(billingResponse);
`;

fs.mkdirSync(path.join(root, "dist/workflows"), { recursive: true });
for (const [name, code] of Object.entries(out)) {
  const file = path.join(root, "dist/workflows", name + ".sdk.js");
  fs.writeFileSync(file, code);
  console.log("dist/workflows/" + name + ".sdk.js", code.length, "bytes");
}

// -------------------------------------------------------------------------------------------- DEPLOY UI PAGE
// Manual helper for environments that cannot run deploy_ui.js: fetches dist/ysquare.html from the public GitHub repo
// (branch configurable in the Page Source node) and upserts it into ys_ui_pages.
const PAGE_URL = process.env.YSQUARE_PAGE_URL || "https://raw.githubusercontent.com/mahensaasAI/Trade-Agent/claude/exciting-cray-0j5jt1/ysquare/dist/live/ysquare.html";
const pageSourceCode = `var SOURCE = ${J(PAGE_URL)};\nreturn [{ json: { url: SOURCE } }];`;
const pageCheckCode = `var html = $input.first().json.data;\nif (typeof html !== 'string') html = String(html || '');\nif (html.length < 100 || html.indexOf('<html') < 0) throw new Error('The fetched page does not look like the Y Square app (' + html.length + ' chars). Check the URL in Page Source.');\nreturn [{ json: { page: 'ysquare', bytes: html.length, params: ['ysquare', html, 'Y Square - Deploy UI Page'] } }];`;
const deployPage = IMPORT + `
const deployPage = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Deploy Page', position: [0, 0] }, output: [{}] });
const pageSource = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Page Source', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(pageSourceCode)} }, position: [224, 0] }, output: [{ url: ${J(PAGE_URL)} }] });
const fetchPage = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Fetch Page', parameters: { method: 'GET', url: expr('{{ $json.url }}'), options: { response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }, timeout: 30000 } }, position: [448, 0] }, output: [{ data: '<!DOCTYPE html>...' }] });
const checkPage = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Check Page', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(pageCheckCode)} }, position: [672, 0] }, output: [{ page: 'ysquare', bytes: 85000, params: ['ysquare', '<!DOCTYPE html>...', 'Y Square - Deploy UI Page'] }] });
const ensureTable = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Ensure Table', parameters: { operation: 'executeQuery', query: 'CREATE TABLE IF NOT EXISTS ys_ui_pages (page text PRIMARY KEY, html text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text)', options: {} }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [896, 0] }, output: [{}] });
const savePage = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Save Page', parameters: { operation: 'executeQuery', query: 'INSERT INTO ys_ui_pages (page, html, updated_at, updated_by) VALUES ($1, $2, now(), $3) ON CONFLICT (page) DO UPDATE SET html = EXCLUDED.html, updated_at = now(), updated_by = EXCLUDED.updated_by RETURNING page, length(html) AS bytes, updated_at', options: { queryReplacement: expr("{{ $('Check Page').first().json.params }}") } }, ${PG}, position: [1120, 0] }, output: [{ page: 'ysquare', bytes: 85000, updated_at: '2026-01-01T00:00:00Z' }] });
const note = sticky(${J("## Y Square - Deploy UI Page\nManual alternative to workflows/deploy_ui.js: fetches the assembled page (ysquare/dist/ysquare.html) from the GitHub repo and upserts it into ys_ui_pages, which the Y Square UI workflow serves at GET /webhook/" + BASE + ".\n\nChange the branch in the Page Source node after merging (main), then run this workflow whenever the page changes.")}, [pageSource, fetchPage, checkPage], { color: 4 });
export default workflow('ysquare-deploy-ui-page', 'Y Square - Deploy UI Page')
  .add(deployPage).to(pageSource).to(fetchPage).to(checkPage).to(ensureTable).to(savePage);
`;
fs.writeFileSync(path.join(root, "dist/workflows/deploy_ui_page.sdk.js"), deployPage);
console.log("dist/workflows/deploy_ui_page.sdk.js", deployPage.length, "bytes");

// ------------------------------------------------------------------------------------- UPLOAD UI PAGE (CHUNKED)
// Helper for environments that can neither reach the deploy endpoint nor GitHub: run it (manual / test mode) with
// webhook data {action:'chunk', page, seq, total, chunk} per piece, then {action:'assemble', page, total}. Each call
// returns md5 + length so every piece can be verified. It is not meant to be published (no key check).
const chunkCode = `// Chunked page upload used when the deploy endpoint cannot be reached directly: chunks are stored in ys_ui_chunks, then
// 'assemble' concatenates them into ys_ui_pages. Every step returns md5 + length so the caller can verify each piece.
const b = $input.first().json.body || {};
const action = String(b.action || 'chunk');
const page = String(b.page || 'ysquare');
if (!/^[a-z0-9-]{1,40}$/.test(page)) throw new Error('bad page slug');
if (action === 'reset') return [{ json: { sql: 'DELETE FROM ys_ui_chunks WHERE page = $1 RETURNING seq', params: [page], action } }];
if (action === 'assemble') {
  const total = Number(b.total || 0);
  return [{ json: { action, sql: "WITH a AS (SELECT string_agg(chunk, '' ORDER BY seq) AS html, count(*) AS n FROM ys_ui_chunks WHERE page = $1), u AS (INSERT INTO ys_ui_pages (page, html, updated_at, updated_by) SELECT $1, a.html, now(), 'chunk-upload' FROM a WHERE a.n = $2 ON CONFLICT (page) DO UPDATE SET html = EXCLUDED.html, updated_at = now(), updated_by = EXCLUDED.updated_by RETURNING md5(html) AS page_md5, length(html) AS page_len, updated_at) SELECT (SELECT n FROM a) AS chunks, (SELECT page_md5 FROM u) AS page_md5, (SELECT page_len FROM u) AS page_len, (SELECT updated_at FROM u) AS updated_at", params: [page, total] } }];
}
const seq = Number(b.seq); const chunk = typeof b.chunk === 'string' ? b.chunk : '';
if (!(seq >= 1 && seq <= 200) || !chunk) throw new Error('seq (1..200) and chunk are required');
return [{ json: { action, sql: 'INSERT INTO ys_ui_chunks (page, seq, chunk) VALUES ($1, $2, $3) ON CONFLICT (page, seq) DO UPDATE SET chunk = EXCLUDED.chunk RETURNING seq, md5(chunk) AS chunk_md5, length(chunk) AS chunk_len', params: [page, seq, chunk] } }];`;
const uploadChunked = IMPORT + `
const uploadChunk = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Upload Chunk', parameters: { httpMethod: 'POST', path: ${J(BASE + "/deploy-ui-chunk")}, responseMode: 'responseNode' }, position: [0, 0] }, output: [{ body: { action: 'chunk', page: 'ysquare', seq: 1, total: 5, chunk: '<!DOCTYPE html>...' } }] });
const validateChunk = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Validate Chunk', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(chunkCode)} }, position: [224, 0] }, output: [{ action: 'chunk', sql: 'INSERT ...', params: [] }] });
const ensureChunks = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Ensure Chunk Table', parameters: { operation: 'executeQuery', query: 'CREATE TABLE IF NOT EXISTS ys_ui_chunks (page text NOT NULL, seq int NOT NULL, chunk text NOT NULL, PRIMARY KEY (page, seq))', options: {} }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [448, 0] }, output: [{}] });
const runUpload = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Run Upload SQL', parameters: { operation: 'executeQuery', query: expr("{{ $('Validate Chunk').first().json.sql }}"), options: { queryReplacement: expr("{{ $('Validate Chunk').first().json.params }}") } }, ${PG}, alwaysOutputData: true, onError: 'continueRegularOutput', position: [672, 0] }, output: [{ seq: 1, chunk_md5: 'abc', chunk_len: 17000 }] });
const uploadResult = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: { name: 'Upload Result', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') }, position: [896, 0] }, output: [{}] });
const note = sticky(${J("## Y Square - Upload UI Page (chunked)\nHelper for publishing the page from environments that cannot reach the deploy endpoint directly: run this workflow with webhook data {action:'chunk', page, seq, total, chunk} once per piece, then {action:'assemble', page, total}. Each call returns md5 and length so every piece can be verified. Not meant to be published: it has no key check and is executed manually (test mode) only.")}, [validateChunk, runUpload], { color: 5 });
export default workflow('ysquare-upload-ui-chunked', 'Y Square - Upload UI Page (chunked)')
  .add(uploadChunk).to(validateChunk).to(ensureChunks).to(runUpload).to(uploadResult);
`;
fs.writeFileSync(path.join(root, "dist/workflows/upload_ui_chunked.sdk.js"), uploadChunked);
console.log("dist/workflows/upload_ui_chunked.sdk.js", uploadChunked.length, "bytes");
