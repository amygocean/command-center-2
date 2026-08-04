# OB Academy Command Center — Handover

A living dashboard over Asana for the Ocean Basket **Academy** (L&D) crew — **Amy, Caitlin, Jess**. Reads a configurable set of Asana projects on every load and writes changes back. Hosted on Vercel.

---

## 1. How it's built (read this first)

- **Vanilla JS, no framework, no build step.** Files load as plain `<script>` tags from `index.html`.
- **Frontend modules** in `js/`: `data.js` (Asana IDs + defaults), `core.js` (state, API plumbing, boot, tabs, calendar helpers), `calendar.js`, `people.js` (The Girls), `campaigns.js`, `content.js` (Studio: shoots/briefs), `events.js` (Masterclasses & Webinars), `content-library.js` + `videos.js` (Content Hub), `communities.js`, `drawer.js` (task drawer + modals), `stores.js`, `platform.js`, `pr.js`, `friday.js`, `news.js`, `demo.js` (`?demo=1` fixtures).
- **Serverless API** in `api/`: everything Asana goes through `POST /api/asana` (`asana.js`), AI through `POST /api/ai` (`ai.js`). `_lib.js` handles the signed httpOnly session cookie + Asana OAuth. `campaign-resource.js` extracts + AI-analyses uploaded files (uses `pdfjs-dist`).
- **Two Asana identities**: `asanaFetch` = the signed-in user's OAuth token; `serviceFetch`/`sharedFetch` = one shared PAT (`ASANA_SHARED_PAT`, falls back to `AMY_PAT`) for shared/app-managed data so all teammates see the same thing.
- **App-managed state** lives as JSON in hidden Asana tasks named `⚙️ …`: `⚙️ dashboard-state` (The Girls layout, corkboard, mention pins), `⚙️ campaign-smart-plan` (per campaign), `⚙️ events-data`, `⚙️ content-library`. These are detected by name prefix and hidden from normal views.

## 2. Deploy — the one thing that bites

- **GitHub repo:** `amygocean/command-center-2` (branch `main`). **Vercel auto-deploys `main` on push** (~1 min). That's the whole deploy flow — just `git add -A && commit && git push origin main`.
- **It is a static site with NO build.** Earlier a `vercel-build` script was added and it **broke the deploy** — reverted. Do **not** add a build step to `package.json` unless you know the Vercel project expects one. `scripts/stamp-version.mjs` exists as a *manual* `npm run stamp` helper only.
- **Cache-busting is manual:** every asset in `index.html` carries `?v=YYYYMMDDx`. **Bump it on every deploy** (`sed -i '' -E 's/\?v=[0-9A-Za-z._-]+/?v=NEWTOKEN/g' index.html`) or users get stale JS/CSS.
- **If a push doesn't deploy:** the push almost certainly worked (`git ls-remote origin -h refs/heads/main`); the problem is the Vercel↔repo connection (Settings → Git) or a build error in the Vercel dashboard.
- **Env vars** (Vercel): `ASANA_CLIENT_ID/SECRET`, `APP_URL` (no trailing slash), `ASANA_WORKSPACE=14491666778313`, `SESSION_SECRET`, `ASANA_SHARED_PAT` (+ `AMY_PAT`/`CAITLIN_PAT`/`JESS_PAT` for My Tasks), one of `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, optional `CONTENT_EDITOR_GIDS`.

## 3. Verify / run locally

- `?demo=1` runs fully on canned data (`js/demo.js`) — **no Asana needed**. Use this to verify UI.
- Local static server: `node serve.cjs` → `http://localhost:3999/?demo=1` (or the Browser-pane preview via `.claude/launch.json` name `static`).
- **`node scripts/check.mjs`** is the regression suite (syntax + behaviour simulations across all files). Run it before every push. Keep its assertions in sync when you change asserted copy/structure.
- **You cannot reach live Asana from an agent session** — the app talks to Asana via the deployed functions with the user's creds. Anything that reads real portfolios/custom fields must be verified after deploy.

## 4. Key Asana IDs (`js/data.js`)

Workspace `14491666778313`. `CC_PROJECT` (Content & Comms) `1213750988186400`; sections `SEC_SHOOT`/`SEC_PLAN`/`SEC_OCC`. `CAMPAIGN_PORTFOLIO` `1216656052977768`. `CURRICULUM_PROJECT` `1216652752864537`. **Content Hub** portfolio `CONTENT_HUB_PORTFOLIO=1217016448186385`; **Academy Courses** project `ACADEMY_COURSES_PROJECT=1214196027650698`. `GIRLS` gids: amy `1213414176761459`, caitlin `1213630129003527`, jess `1213630128899336`.

## 5. What was built recently (all on `main`, latest `a773d41`)

- **Mentions** (`drawer.js`): Handled state + **History** tab (All/History/Hidden), inline reply, person filter, keyboard nav; heavy `get_mentions` scan made incremental + cached server-side.
- **Events tab** (`events.js`): Masterclasses & Webinars — type/format/host, sessions, roles (FOH/BOH/Sushi/Mgmt/Bar-Deli), goal, campaign link, real-subtask checklist, contacts, AI "Plan this event". Logistics stored in `⚙️ events-data`.
- **The Girls**: personal "Up for grabs" hide-card / hide-column / restore.
- **Delete**: campaigns (Archive **or** Delete-permanently confirm, per-time) + tasks; API `archive_project`/`delete_project`/`delete_task {shared}`.
- **Smart connections**: Event → "Plan a shoot" (linked, brief-seeded); shoot ↔ campaign; campaign → "Schedule masterclass" (creates a linked Event on Smart-Plan apply).
- **Recipe-first Campaigns** (`campaigns.js`): rebuilt `CAMPAIGN_PLAN_RULES` around the real menu cadence (recipes in → training tools/cheat sheets → region-split internal training → course internal→all teams → masterclasses → launch → post-launch tips); AI plan **ungated** (runs from notes, not just uploads) and fed linked events; `masterclass` recs create real Events.
- **Better brief** (`content.js`): auto-pulls the linked campaign's analysed recipes, produces a **finished** brief (no scaffolding), **Download PDF** (branded, print-to-PDF, no deps). Recipe analysis (`api/campaign-resource.js`) now captures station / exact quantities / on-screen pop-ups. **"Shots from recipes"** button creates one shot per recipe; **"Re-analyse all"** on Resources. Inline **assignee picker** on shoot to-dos.
- **Calendar**: day cells **expand to show all tasks** (no "+N more"). **Two-tier tab nav** (primary underline row + secondary pill row). **Trainer-visits toggle** (`cfg.showTrainerVisits`) hides all trainer visits while keeping store openings.
- **Content Hub** (`content-library.js`, `videos.js`, API `get_content_library`): see below.

## 6. Content Hub — current state & next steps

**What it is:** the Content tab is a **read-only front door** to published content. `get_content_library` (in `api/asana.js`) reads every project in the Content Hub portfolio + the Academy Courses project, flattens tasks with their **custom fields**, and **strips edit/source-link fields unless the signed-in user is Amy or Jess** (`CONTENT_EDITORS`, matched by `EDIT_LINK_FIELD_RE`).

**UI:** spotlight search · type chips · Role/Programme filters · All / Needs-attention / Archived views · **Wheel** (default) or **List** toggle · detail panel (Open / Copy / Asana / gated Edit). Courses show expandable modules (via `get_subtasks`). "**+ Add resource**" keeps app-added local items merged in. **128 uploaded training videos** are bundled in `js/videos.js` (auto-grouped by keyword) so they're searchable now; the live Asana Videos project supersedes them once broken into subtasks.

**The wheel:** category **donut** — slices sized by count; click a slice → its videos fan out as a ring of dots; click a dot → opens it; breadcrumb back; **🎡 Surprise me** for a random pick.

**⚠️ Field mapping is heuristic and UNVERIFIED against live Asana.** `content-library.js` guesses fields by name (`libType`/`libRole`/`libProgramme`/`libStatus`/`libPublished`/`libEdit`). **First live task:** open the tab as a real user, confirm the custom-field names map. If e.g. their status field is named unexpectedly, pin the regexes to the real field names. Confirmed decisions: read-only front door; edit links Amy/Jess only (server-enforced); combine portfolio + Courses project (don't add Courses to the portfolio); individual videos ultimately; hide `Remove`-status under Archived; **keep "add from here"**.

**Stage 2 (pending):** (1) **Related content sets** — open a course → see its videos/recipes/templates/campaign (best via a shared "Content set / Campaign" Asana field, per the plan). (2) Flatten the "10 videos" bundles into individual Asana subtasks. (3) Make **"Add resource" write a real Asana task** in a chosen hub project with its custom fields (Stage 1 keeps app-added items local). (4) Optionally group the wheel by the real Asana **programme/role** field instead of keyword categories.

## 7. Working style / gotchas

- Verify UI changes in `?demo=1` (Browser pane), check console for errors, then push. Report outcomes honestly.
- **Only push when asked.** Bump `?v=` on every push. Run `check.mjs`.
- Reporting apps are separate Vercel sites linked from the **Reports** tab: `https://oceanbasketacademy.com/leaderboard/` and `https://oceanbasketacademy.com/` (user has their GitHubs/Vercels — a v2 could embed or pull metrics).
- The user prefers **shipping over long Q&A**; for genuinely ambiguous/expensive UI (e.g. the wheel) offer 2–3 concrete options with previews rather than guessing.
- Persistent memory for this project lives in `/Users/amygray/.claude/projects/-Users-amygray-Desktop-new/memory/` (`MEMORY.md` index + per-fact files).
