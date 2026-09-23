# Y Square Workplace

Y Square Workplace is built on the same lines as the Neon Logistics workplace: a single-page app served by n8n, a
JSON services API, an agents chat with a Model Router, and a shared Postgres. It hosts three agents:

| Agent | What it does | Backend |
| --- | --- | --- |
| **Athlete Edge** | The go-to for young athletes: what to eat and drink before, during and after training, games and tournaments, matched to the athlete profile (sport, age group, schedule, allergies and diet). Grounded on a sports-nutrition knowledge base with citations, safety rules (food first, no supplements or diets for minors) and a meal-plan card. | Y Square Agents (Model Router) |
| **StudyPals** | Tutor, lesson generator, quizzes and Q&A over the class materials a coach uploaded. It runs entirely inside Y Square - there is no separate StudyPals site to visit. | The StudyPals workflow family on this same n8n (see below) |
| **SynthIQ** | Research companion for medical and health-science students. Searches only the sources the student switches on - PubMed/MEDLINE, PubMed Central, Cochrane reviews, ClinicalTrials.gov, medRxiv/bioRxiv preprints and Crossref - then answers from the records it retrieved and marks every claim with the paper it came from. Citations render as links to PubMed, the DOI or the trial registry. | Y Square SynthIQ (own workflow) |
| **Event Planner** | Replaces WhatsApp threads with one place per event: checklist with owners and due dates, RSVPs and headcount, pinned information and announcements, and an event chat. The AI planner drafts checklists and announcements from a brief and adds them with one click. | Y Square Services + Agents |

**Models.** Free (no sign-up): Gemini Flash, Mistral, Groq. Premium: Claude and ChatGPT. Guests are identified by a
browser-generated guest id; Premium needs a quick sign-up (Google or email + password) and a subscription.

Model ids live in `ys_models` (editable by an admin in the app). Groq is set to `openai/gpt-oss-120b` because the older
Llama ids are no longer served on this Groq account; Gemini and Groq run with an 8000-token output budget because both
spend part of it on reasoning. If a provider answers with a rate-limit error (seen once with Mistral's free key), the
reply says so and the user can pick another free model.

## URLs

Production is `https://ysquareai.com` and non-prod is the duckdns host below. Both are served by the same GCP VM and the
same n8n instance; see [Hosting and domains](#hosting-and-domains) for how one is routed to the other.

| Purpose | URL |
| --- | --- |
| App (production) | `https://ysquareai.com/` |
| App (non-prod) | `https://n8n-neonai.duckdns.org/webhook/Y2Workplace` |
| Services API | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/svc/api` `{action, payload}` |
| Agents chat | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/svc/chat` `{agentId, message, model, conversationId, context}` |
| SynthIQ chat | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/svc/synthiq` `{message, model, conversationId, context:{sources,years,types,openAccess,perSource}}` |
| Deploy page | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/deploy-ui` (header `X-Deploy-Key`) |
| Billing webhook | `POST https://n8n-neonai.duckdns.org/webhook/Y2Workplace/billing/stripe?key=...` |

Callers send either `X-Guest-Id: guest-...` (free version) or `Authorization: Bearer <token>` (member).

## n8n workflows

| Workflow | Role |
| --- | --- |
| Y Square UI | Serves the page from `ys_ui_pages`; key-protected deploy endpoint |
| Y Square Services | API: guests, sign-up, login, Google sign-in, events, tasks, updates, RSVPs, admin |
| Y Square Agents | Chat: live context, daily limits, free/premium tiers, Model Router, StudyPals proxy |
| Y Square SynthIQ | SynthIQ chat: literature retrieval from the selected sources, daily limits, free/premium tiers, Model Router, cited answers. Deliberately separate from Y Square Agents so retrieval problems cannot affect the other three agents |
| Y Square - DB Migration | Creates the `ys_*` tables and seeds models, settings, knowledge and a sample event (idempotent) |
| Y Square - DB Functions | `ys_effective_plan`, `ys_bootstrap`, `ys_event_detail`, `ys_admin_overview` (idempotent) |
| Y Square - Deploy UI Page | Manual alternative to `deploy_ui.js`: fetches `dist/live/ysquare.html` (the live page snapshot) from GitHub and upserts it into the row named by `TARGET` in the Page Source node (`ysquare-next` by default) |
| Y Square - Promote UI to Production | Copies `ysquare-next` onto `ysquare`, backing the current production page up to `ysquare-prev` first |
| Y Square - Roll Back UI | Restores `ysquare-prev` onto `ysquare`, undoing the last promotion |
| Y Square - Cutover Check | Read-only: resolves ysquareai.com, reports what each hostname serves, checks the n8n editor is 404 on production, and lists the `ys_ui_pages` rows |
| Y Square - Upload UI Page (chunked) | Manual helper: uploads the page in MD5-verified chunks via workflow executions (never publish it) |
| Y Square - Volunteer Links (Dallas) | Weekly link keeper for the volunteer board: re-checks the curated Dallas listings, falls back to the next candidate URL, refreshes each blurb from the page itself and upserts them into `ys_volunteer` |
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
  workflows/deploy_ui.js        publishes dist/ysquare.html to a ys_ui_pages row (YSQUARE_PAGE, default ysquare-next)
  workflows/check.js            parse-checks every Code node body and the app
  workflows/keys.sha256.json    SHA-256 of the deploy key and billing key (the keys themselves are not in git)
  deploy/nginx/                 nginx server block for the production hostname
  deploy/README.md              runbook for putting the app on ysquareai.com
```

## Working on it

```bash
cd ysquare
npm run check                 # parse-check the Code node bodies and the app
npm run gen                   # rebuild dist/ysquare.html and dist/workflows/*.sdk.js
YSQUARE_DEPLOY_KEY=... npm run deploy:ui     # publish the repo build (dist/ysquare.html) to the ysquare-next row
# the repo build is behind dist/live/ysquare.html, so this never targets production unless YSQUARE_PAGE=ysquare is set
# to ship the live page instead, run "Y Square - Deploy UI Page" in n8n (see Live page snapshot below)
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

## SynthIQ sources

SynthIQ never answers from the model's memory: `Fetch Papers` retrieves records first and the prompt is built
around them, so an empty search produces "nothing found", not an invented answer. Each source the student
switches on is one API call, run in parallel, de-duplicated by DOI / PMID / registry id and capped at 14 records.

| Source key | Shown as | Retrieved from |
| --- | --- | --- |
| `pubmed` | PubMed / MEDLINE | Europe PMC REST, `SRC:MED` (the MEDLINE records, linked back to pubmed.ncbi.nlm.nih.gov) |
| `pmc` | PubMed Central | Europe PMC REST, `SRC:PMC` (open-access full text) |
| `cochrane` | Cochrane Reviews | Europe PMC REST, filtered to the Cochrane Database of Systematic Reviews |
| `trials` | ClinicalTrials.gov | ClinicalTrials.gov API v2 (`/api/v2/studies`) |
| `preprints` | Preprints (medRxiv, bioRxiv) | Europe PMC REST, `SRC:PPR` |
| `crossref` | Crossref journals | Crossref REST (`/works`), for literature beyond biomedicine |

Filters passed in `context`: `years` (`any`, `5`, `10`), `types` (`any` or `evidence` = reviews, meta-analyses and
trials), `openAccess` (free full text only) and `perSource` (3, 5 or 8). No API keys are needed and no personal
data is sent to any of these services - only the question text. The panel choices are stored in the browser
(`ys.sq` in localStorage) and re-sanitised server-side against the fixed source list.

Answers cite as `[P1]`, `[P2]`; `Format Reply` keeps only the citations the answer actually used and returns them
with their URLs, which the page renders as links under the message.

## Volunteer listings (Dallas)

The volunteer board carries six curated listings for the Dallas area alongside whatever members post. They are
not typed into the database by hand: `volunteer/dallas.json` is the catalogue, and the
"Y Square - Volunteer Links (Dallas)" workflow keeps them true.

| Slot | Organisation | Link |
| --- | --- | --- |
| Community | Karya Siddhi Hanuman Temple (listed as "Hanuman Temple") | `dallashanuman.org/volunteer` |
| Medical | Parkland Health | `parklandhealth.org/volunteer` |
| Business | United Way of Metropolitan Dallas | `unitedwaydallas.org/volunteer/` |
| Law | Dallas Volunteer Attorney Program | `dallasvolunteerattorneyprogram.org` |
| IT | Tech Titans | `techtitans.org/volunteer` |
| Red Cross / relief | American Red Cross, North Texas | `redcross.org/local/texas/north-texas/volunteer.html` |

The board is aimed at students aged 12 to 21 who are building a profile, so every listing shows "Ages 12 to 21";
where an organisation sets its own minimum age, the catalogue carries a `note` that is appended to the description
rather than a guessed number.

Every Monday (and on demand from the workflow's "Refresh Now" trigger) `Resolve Links` requests each candidate URL
in the catalogue, keeps the first one that still answers, and refreshes the listing's description from that page's
own meta description. Sites that only block datacentre traffic (403, 429 and friends) count as live. If every
candidate for a listing is dead the row is soft-removed with `removed_at`, so the board drops it instead of sending
students to a 404.

Rows are written as `vol-dallas-<key>` with `created_by = 'system'` and `status = 'approved'`, so they sit next to
community submissions rather than in the admin approval queue. `vol.list` needs a session, so the same list is also
mirrored into `ys_settings.organization.volunteerOpportunities`, which is the fallback the page reads when nobody is
signed in. To change what is listed, edit `volunteer/dallas.json`, run `npm run gen:volunteer`, update the workflow
from `dist/workflows/volunteer_links.sdk.js` and run it once. Other cities get their own catalogue file the same way.

## Hosting and domains

One GCP VM runs everything: nginx terminates TLS, n8n runs behind it, and the database is CloudSQL. The two hostnames
resolve to that same VM and differ only in which page row they get:

| | Production | Non-prod |
| --- | --- | --- |
| Hostname | `ysquareai.com`, `www.ysquareai.com` | `n8n-neonai.duckdns.org` |
| DNS | Route 53 A record -> the VM's static IP | duckdns A record -> the same IP |
| App path | `/` | `/webhook/Y2Workplace` |
| `ys_ui_pages` row | `ysquare` | `ysquare-next`, falling back to `ysquare` |

The **Y Square UI** workflow reads the `Host` header (`X-Forwarded-Host` when nginx sets it) in its Pick Page node. The
production hostnames select the `ysquare` row; every other host selects `ysquare-next`. The query coalesces to `ysquare`,
so a missing `ysquare-next` row serves production rather than an error page, and the non-prod host keeps working before
anything has been staged.

The page finds its own API base at runtime: `detectBase()` keeps everything after `/webhook/Y2Workplace` when that appears
in the path, and otherwise uses `location.origin`, which is what makes the same HTML work mounted at the site root.

nginx on the production server only needs to expose the app and its API, not the n8n editor:

| Location | Proxied to |
| --- | --- |
| `/` | `/webhook/Y2Workplace` |
| `/svc/` | `/webhook/Y2Workplace/svc/` |
| `/studypals/` | `/webhook/studypals/` |
| `/billing/stripe` | `/webhook/Y2Workplace/billing/stripe` |

Everything else on the production hostname should 404. Keep `X-Robots-Tag: noindex` on the duckdns server block so the
non-prod copy stays out of search results, and add `https://ysquareai.com` to the Google OAuth authorised origins.

The server block is checked in at [`deploy/nginx/ysquareai.com.conf`](deploy/nginx/ysquareai.com.conf), and
[`deploy/README.md`](deploy/README.md) is the step-by-step cutover runbook: reserving the IP in GCP, the Route 53
records, installing the block, certbot, the OAuth origins and the promotion.

## StudyPals

StudyPals is not a separate product with its own URL. Its workflows - tutor, lesson generator, quiz generator, student
Q&A, teacher upload, library read/download/delete, voice and the scheduled activity rollups - live on this same n8n and
this same CloudSQL database, all under the `/webhook/studypals/` path. Y Square is the only front end for them, so a
student never leaves `ysquareai.com`.

There are two ways they get called, and they are deliberately different:

| Caller | URL it uses | Why |
| --- | --- | --- |
| The browser (teacher library, uploads, downloads, deletes) | `<site origin>/studypals/...` | derived from the page's own origin, so nginx maps it to `/webhook/studypals/...` on whichever hostname the visitor is on |
| The Agents workflow (tutor chat) | `http://127.0.0.1:5678/webhook/studypals/tutor/ask` | n8n calling itself; no DNS, no TLS handshake and no trip out to the public internet and back |

The server-side base comes from `ys_settings.studypals.baseUrl` and is editable in Admin > Settings. Keep it on loopback
unless StudyPals moves to a different host: pointing it at a public hostname makes production depend on that name
resolving, and hard-codes one environment's hostname into the other's traffic.

There used to be an `openUrl` setting linking out to a standalone StudyPals app. The tutor, lessons, quizzes and
materials are all inside Y Square now, so that setting is gone and nothing links off-site.

## Live page snapshot

`dist/live/ysquare.html` is the page served from `ys_ui_pages`. It carries features that were added to the live page
directly (Volunteer opportunities and their moderation queue, notifications, AI Playground, Teacher Tools, OTP sign-up)
and are not in `ui/` yet, so the repo build in `dist/ysquare.html` is behind it. Until those sources are merged into
`ui/`, publish only the snapshot, and never run `npm run deploy:ui` without setting `YSQUARE_PAGE` - it publishes
`dist/ysquare.html`, the older repo build.

To ship a change:

1. edit `dist/live/ysquare.html`, commit and push;
2. run **Y Square - Deploy UI Page** with `TARGET = "ysquare-next"` and check the md5 it returns against the local file
   (`md5sum dist/live/ysquare.html`);
3. test on `https://n8n-neonai.duckdns.org/webhook/Y2Workplace`, which now serves that staging row;
4. run **Y Square - Promote UI to Production** to copy it onto `ysquare`. It saves the outgoing page to `ysquare-prev`
   first, so **Y Square - Roll Back UI** can undo the promotion.
