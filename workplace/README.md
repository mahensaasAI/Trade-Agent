# WorkPlace (OraDayForce)

The internal AI workspace for OraDayForce, served at `/webhook/workplace`. Separate app from Y Square
Workplace: its own schema (`wp_*`), its own agents and its own sign-in.

## How it is served today

Unlike Y Square, whose page lives in a `ys_ui_pages` row, the WorkPlace page is a **105 KB string inlined in
the `Serve WorkPlace App` node** of the `WorkPlace UI` workflow (`y55BOvCAIXsbDsEv`). There is no staging row,
no md5 check and no rollback: editing the page means rewriting that node.

`dist/live/workplace.html` in this folder is a byte-exact copy of what that node currently serves
(md5 `4c5b0678ddc7710024b2509a0f70c937`, 105,338 bytes), captured 2026-09-22 so the page has a diff base.

## Workflows

| Workflow | Id | Role |
| --- | --- | --- |
| WorkPlace UI | `y55BOvCAIXsbDsEv` | serves the SPA at `/webhook/workplace` (page inlined in the node) |
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

## Where it differs from Y Square today

| | WorkPlace | Y Square |
| --- | --- | --- |
| Page storage | inlined in the workflow node | `ys_ui_pages` row, with staging and rollback |
| Accent colour | `#4f46e5` | `#4f46e5` (already the same) |
| Themes | light + dark | light + dark |
| Breakpoints | 1080, 860 | 1000, 760, 640 plus iPhone work (dvh, safe-area, swipe) |
| Mobile nav | sidebar only | sidebar on desktop, bottom tab bar + drawer on phones |
| Plans | none - no free/premium/guest/upgrade anywhere in the page | free and premium, guest mode, upgrade flow |
| Permissions | `wp_users.role` holds a job title ("Practice Director"), not a permission | `ys_users.role` is member / teacher / admin |
| Models | Claude allowlist only | free: Gemini Flash, Groq, Mistral; premium: ChatGPT, Claude |

The two rows that matter for the current request: **WorkPlace has no plan or permission concept at all**, and
its `role` column is a displayed job title rather than an access level.
