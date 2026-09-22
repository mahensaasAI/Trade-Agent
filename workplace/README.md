# WorkPlace (OraDayForce)

The internal AI workspace for OraDayForce, served at `/webhook/workplace`. Separate app from Y Square
Workplace: its own schema (`wp_*`), its own agents and its own sign-in.

## How it is served

The page lives in the `wp_ui_pages` table and `dist/live/workplace.html` is its source of truth. Two URLs, one
workflow:

| URL | Row | |
| --- | --- | --- |
| `/webhook/workplace` | `workplace` | production |
| `/webhook/workplace-next` | `workplace-next` | staging, falls back to production when no staging row exists |

To ship a change: edit `dist/live/workplace.html`, commit and push, run **WorkPlace - Deploy UI Page** (it
defaults to the staging row), compare the md5 it returns with `md5sum dist/live/workplace.html`, look at
`/webhook/workplace-next`, then run **WorkPlace - Promote UI to Production**. That saves the outgoing page to
`workplace-prev`, so **WorkPlace - Roll Back UI** undoes it.

The deploy helper resolves the branch head commit and fetches that immutable URL rather than the branch path,
because `raw.githubusercontent.com/.../<branch>/...` serves a cached copy for minutes after a push - long
enough to silently deploy the previous version, which is exactly what happened the first time. `updated_by`
on each row records the short SHA that produced it.

It was not always this way: until 2026-09-22 the page was a 105 KB string inlined in the `Serve WorkPlace App`
node, with no staging row, no md5 check and no way back.

## Workflows

| Workflow | Id | Role |
| --- | --- | --- |
| WorkPlace UI | `y55BOvCAIXsbDsEv` | serves the SPA from `wp_ui_pages` at `/webhook/workplace` and `/webhook/workplace-next` |
| WorkPlace - Deploy UI Page | `bd9Ld2XaAEgzqK72` | publishes `dist/live/workplace.html` into the row named by `TARGET` |
| WorkPlace - Promote UI to Production | `ajSLmUcbaQOh6vQD` | staging to production, backing up to `workplace-prev` |
| WorkPlace - Roll Back UI | `eyJKF2o9BW6Z55Rz` | restores `workplace-prev` |
| WorkPlace - Page Check | `yF1rqiYtiBAeJKvB` | read-only: both URLs md5-match the rows they should serve |
| WorkPlace - DB Plans and Admin | `NOqAoFOcakzclZ9W` | idempotent: org plans, the admin flag and `wp_models` |

A snapshot of `WorkPlace Services` as it ran before the database work, with the md5s of every Code node,
is kept at [`workflows/snapshots/WorkPlace_Services.pre-db.json`](workflows/snapshots/WorkPlace_Services.pre-db.json).
| WorkPlace Services | `V5SDJzqlQTdFf7dD` | authenticated API: bootstrap, chat, knowledge search, ingestion |
| WorkPlace — DB Migration | `h1RHiUgggb5TUzQ1` | idempotent schema + seed (not active) |
| WorkPlace | `LpSwabUQbgzZ2PM1` | the original single-workflow MVP (not active) |

## Data

`wp_organizations`, `wp_users`, `wp_agents`, `wp_projects`, `wp_project_agents`, `wp_conversations`,
`wp_messages`, `wp_documents`, `wp_document_chunks`, `wp_activity` - all in the same CloudSQL database as
Y Square.

One organization (`org-oradayforce`) and one user: Raju, `raju@oradayforce.com`.

Eight agents, unchanged: Solution Architect, Proposal Builder, Oracle Fusion SQL, Data Engineering, MLOps,
Integration, Governance, Knowledge.

## Plans, permissions and models

Added 2026-09-22 by **WorkPlace - DB Plans and Admin** (idempotent):

- **`wp_organizations.plan`** - `free` or `premium`, with `plan_expires_at`. The plan sits on the organization
  rather than the person, because a company buys it, not an individual.
- **`wp_users.is_admin`** - a separate boolean. `wp_users.role` was left alone: it holds a displayed job title
  ("Practice Director"), not an access level, and overwriting it would have wiped that.
- **`wp_models`** - the same five models as Y Square. Free: Gemini Flash, Groq, Mistral. Premium: Claude,
  ChatGPT.

`raju@oradayforce.com` is `is_admin = true`. OraDayForce is on **premium**, because WorkPlace has always run on
Claude and leaving it on free would have taken away what the product does today.

The free tier is for signed-in users only. There is no guest mode: the knowledge base holds client documents,
so nothing renders before sign-in.

## Where it differs from Y Square today

| | WorkPlace | Y Square |
| --- | --- | --- |
| Page storage | `wp_ui_pages` row, with staging and rollback | `ys_ui_pages` row, with staging and rollback |
| Accent colour | `#1d4e7f` navy, indigo `#4f46e5` on primary buttons only | `#4f46e5` indigo throughout |
| Themes | light + dark | light + dark |
| Breakpoints | 1080, 860 | 1000, 760, 640 plus iPhone work (dvh, safe-area, swipe) |
| Mobile nav | sidebar only | sidebar on desktop, bottom tab bar + drawer on phones |
| Plans | free and premium on the organization; no guest mode | free and premium per user, plus guest mode |
| Permissions | `wp_users.is_admin`, with `role` kept as a job title | `ys_users.role` is member / teacher / admin |
| Models | same five as Y Square, in `wp_models` | free: Gemini Flash, Groq, Mistral; premium: ChatGPT, Claude |

## Services and the database

Until 2026-09-22 `WorkPlace Services` held no database nodes at all: login checked a hardcoded `USERS`
array, and bootstrap returned hardcoded organisation, projects, agents and a Claude-only model list. The
`wp_*` tables existed but the running app never read them, so the plan and admin flag were invisible to the
product.

Two branches now read CloudSQL. The sources are in [`services/`](services):

| Node | Source | What it does |
| --- | --- | --- |
| Find User | - | `SELECT ... FROM wp_users WHERE lower(email) = lower($1)` |
| Verify Credentials | [`verify_credentials.js`](services/verify_credentials.js) | compares the hash, mints the session, carries `is_admin` into it |
| Load Workspace Rows | [`load_workspace_rows.sql`](services/load_workspace_rows.sql) | one query returning the whole payload as jsonb |
| Load Workspace Data | [`load_workspace_data.js`](services/load_workspace_data.js) | authorises, then shapes the response; withholds premium models from a free organisation |

The password scheme is unchanged - the Crypto node still hashes `password + ":" + lowercased email` with
SHA-256 - and the stored hash matched the previously hardcoded one exactly, so existing passwords keep
working.

Sessions still live in this workflow's static data rather than a table. That is deliberate for now: the
chat, search and ingest endpoints each authorise against that same in-memory store, so moving sessions to
the database means changing all of them at once. The consequence is that **everyone is signed out whenever
the workflow restarts**.

Verified end to end against the live endpoints, using a temporary account that was created and then deleted:
sign-in succeeds and returns the admin flag, a wrong password is rejected, a request with no token is
rejected, and bootstrap returns the organisation plan, five tiered models, six projects and eight agents
from the database. `wp_users` was left with only Raju's account.

### What changed on screen

The dashboard numbers are now real rather than illustrative. Documents and conversations read 0 because
those tables are genuinely empty, where the hardcoded payload claimed 1,248 and 324; project cards show 0
documents for the same reason, and the Knowledge view is empty until something is ingested. Projects,
agents, names, descriptions, capabilities and starters are unchanged, because the database seed matches
what was hardcoded.

## Still to do

The palette is done and staged. Remaining, in order:

1. **Navigation and mobile.** WorkPlace has two breakpoints (1080, 860) and a sidebar only. It needs Y Square's
   treatment: a bottom tab bar and drawer on phones, `100dvh` with safe-area insets, and swipe between views.
2. **Plan UI.** A plan badge, a model picker that shows the free models and marks the premium ones locked, and
   an upgrade path for admins. Nothing in the page reads `plan` yet.
3. **Admin view.** Raju is `is_admin` in the database, but the page has no admin section to show him.
4. **Model routing in WorkPlace Services.** The chat still calls Claude directly. `Build Agent Context` has
   its own hardcoded Claude-only model list, so the free models bootstrap now advertises are not reachable
   from chat yet. This needs that list replaced with `wp_models`, a Model Router switch, and per-provider
   model nodes for Gemini, Groq and Mistral alongside Claude and ChatGPT - the pattern Y Square Agents
   already uses - plus a server-side plan check so a free organisation cannot reach a premium model.
5. **Persistent sessions.** Move the session store out of workflow static data into a table, so a workflow
   restart does not sign everyone out. Touches the auth block in all five authenticated Code nodes.
