# Y Square Workplace

Y Square Workplace is built on the same lines as the Neon Logistics workplace: a single-page app served by n8n, a
JSON services API, an agents chat with a Model Router, and a shared Postgres. It hosts three agents:

| Agent | What it does | Backend |
| --- | --- | --- |
| **Athlete Edge** | The go-to for young athletes: what to eat and drink before, during and after training, games and tournaments, matched to the athlete profile (sport, age group, schedule, allergies and diet). Grounded on a sports-nutrition knowledge base with citations, safety rules (food first, no supplements or diets for minors) and a meal-plan card. | Y Square Agents (Model Router) |
| **StudyPals** | The existing StudyPals tutor. Chat is proxied to `https://n8n-neonai.duckdns.org/webhook/studypals/tutor/ask` with the student id, grade, subject and topic; the full StudyPals app is linked from the panel. | Existing StudyPals workflows |
| **Event Planner** | Replaces WhatsApp threads with one place per event: checklist with owners and due dates, RSVPs and headcount, pinned information and announcements, and an event chat. The AI planner drafts checklists and announcements from a brief and adds them with one click. | Y Square Services + Agents |

**Models.** Free (no sign-up): Gemini Flash, Mistral, Groq. Premium: Claude and ChatGPT. Guests are identified by a
browser-generated guest id; Premium needs a quick sign-up (Google or email + password) and a subscription.

Model ids live in `ys_models` (editable by an admin in the app). Groq is set to `openai/gpt-oss-120b` because the older
Llama ids are no longer served on this Groq account; Gemini and Groq run with an 8000-token output budget because both
spend part of it on reasoning. If a provider answers with a rate-limit error (seen once with Mistral's free key), the
reply says so and the user can pick another free model.

## URLs

| Purpose | URL |
| --- | --- |
| App | `https://n8n-neonai.duckdns.org/webhook/Y2Workplace` |
| Services API | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/svc/api` `{action, payload}` |
| Agents chat | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/svc/chat` `{agentId, message, model, conversationId, context}` |
| Deploy page | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/deploy-ui` (header `X-Deploy-Key`) |
| Billing webhook | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/billing/stripe?key=...` |

Callers send either `X-Guest-Id: guest-...` (free version) or `Authorization: Bearer <token>` (member).

## n8n workflows

| Workflow | Role |
| --- | --- |
| Y Square UI | Serves the page from `ys_ui_pages`; key-protected deploy endpoint |
| Y Square Services | API: guests, sign-up, login, Google sign-in, events, tasks, updates, RSVPs, admin |
| Y Square Agents | Chat: live context, daily limits, free/premium tiers, Model Router, StudyPals proxy |
| Y Square - DB Migration | Creates the `ys_*` tables and seeds models, settings, knowledge and a sample event (idempotent) |
| Y Square - DB Functions | `ys_effective_plan`, `ys_bootstrap`, `ys_event_detail`, `ys_admin_overview` (idempotent) |
| Y Square - Deploy UI Page | Manual alternative to `deploy_ui.js`: fetches `dist/live/ysquare.html` (the live page snapshot) from GitHub and upserts it |
| Y Square - Upload UI Page (chunked) | Manual helper: uploads the page in MD5-verified chunks via workflow executions (never publish it) |
| Y Square Billing | Records payment events and switches plans (Stripe Payment Link / Checkout) |

The SDK code that created each workflow is in `dist/workflows/*.sdk.js`, generated from the sources below.

## Project layout

```
ysquare/
  db/schema.sql          tables (ys_* prefix, shared Postgres)
  db/seed.sql            models, agent defaults, settings, knowledge base, sample event, admin user
  db/functions.sql       Postgres functions used by the API (split on "-- @@")
  services/route_request.js     Services: permissions + one parameterised SQL statement per action
  services/format_response.js   Services: API envelope, sessions, agent catalogue
  agents/prepare_chat.js        Agents: caller + live-context query
  agents/build_prompt.js        Agents: limits, tiers, personas, system prompt, StudyPals proxy
  agents/format_reply.js        Agents: normalise output, plan/action blocks, run log
  ui/index.html, ui/styles.css, ui/app.js   the single-page app
  workflows/gen_ui.js           assembles dist/ysquare.html
  workflows/gen_workflows.js    emits dist/workflows/*.sdk.js (embeds the sources above)
  workflows/deploy_ui.js        publishes dist/ysquare.html to the running UI workflow
  workflows/check.js            parse-checks every Code node body and the app
  workflows/keys.sha256.json    SHA-256 of the deploy key and billing key (the keys themselves are not in git)
```

## Working on it

```bash
cd ysquare
npm run check                 # parse-check the Code node bodies and the app
npm run gen                   # rebuild dist/ysquare.html and dist/workflows/*.sdk.js
YSQUARE_DEPLOY_KEY=... npm run deploy:ui     # publish the repo build (dist/ysquare.html) through the deploy endpoint
# or run "Y Square - Deploy UI Page" in n8n, which publishes dist/live/ysquare.html (see below)
```

After changing a Code node body or the SQL, regenerate and update the matching workflow in n8n (validate the SDK code,
then `update_workflow`), and re-run the DB Migration / DB Functions workflows when the SQL changed. They are idempotent.

## Accounts, plans and payments

* Admin: `raju@oradayforce.com` with the same password as WorkPlace / Neon Logistics (seeded as Premium).
* Sign-up is free and keeps the guest's events, RSVPs and athlete profile (they are moved to the new account).
* Google sign-in: create an OAuth Web client in Google Cloud, add the site origin to the authorised JavaScript origins and
  paste the client id in Admin > Settings. The API verifies the ID token with Google and checks the audience.
* Premium: put a Stripe Payment Link in Admin > Settings (checkout URL). The app appends `client_reference_id` (user id)
  and `prefilled_email`; point the Stripe webhook at the billing URL above with the billing key, and
  `checkout.session.completed` / `invoice.paid` activate Premium for a month (plus 3 days grace). Admins can also set a
  plan manually in Admin > Users. For production, add Stripe signature verification to the billing workflow.
* Daily limits (Admin > Settings): guests 30 messages, free members 150, premium 1000 by default.

## API actions

Guest level: `bootstrap`, `profile.save`, `knowledge.search`, `events.list|create|join|get|update`, `tasks.create|update`,
`updates.post|pin`, `messages.post`, `rsvp.set`, `members.set_role`. Open: `signup`, `login`, `login.google`.
Member: `logout`, `account.get`, `billing.checkout`. Admin: `admin.overview`, `users.set_plan`, `users.update`,
`models.update`, `agents.set_model`, `settings.update`, `agents.runs`.

Chat context: `{eventId}` for Event Planner, `{grade, subject, topic, studentId}` for StudyPals. Replies may carry a
`plan` card (Athlete Edge) or `actions` (`create_tasks`, `post_update`) that the UI applies through the API.

## Live page snapshot

`dist/live/ysquare.html` is the page currently served at `/webhook/Y2Workplace`. It carries features that were added to the
live page directly (Volunteer opportunities, AI Playground, Teacher Tools, OTP sign-up) and are not in `ui/` yet, so the
repo build in `dist/ysquare.html` is behind it. Until those sources are merged into `ui/`, publish only the snapshot: edit
`dist/live/ysquare.html`, commit, push, and run the "Y Square - Deploy UI Page" workflow. Running `npm run deploy:ui` would
replace the live page with the older repo build.
