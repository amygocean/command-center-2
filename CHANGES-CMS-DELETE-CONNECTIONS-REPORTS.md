# Content Library, delete, smart connections & Reports

Four features added in one pass.

## 1. Delete campaigns & tasks
- **Campaign detail → Delete.** A confirm dialog offers **Archive** (reversible in
  Asana) or **Delete permanently** (also deletes the campaign's tasks). You choose
  each time. The campaign is then dropped from the portfolio, projects, calendar
  and app state.
- **Task drawer → Delete** (and the intent is reused elsewhere). Confirm dialog,
  with a nudge to use *Done* instead if you only want it off your list. Shared
  boards (Communities, campaigns) delete through the service identity.
- New API tools: `archive_project`, `delete_project`; `delete_task` gained a
  `shared` flag.

## 2. Smart connections (shoots ↔ events ↔ communities ↔ campaigns)
- **Event → "🎬 Plan a shoot"** creates a shoot day ~7 days before the event,
  pre-seeded with the event's goal/audience so the brief has context, and linked
  both ways (the button becomes "Open shoot").
- **Event → "Queue promo"** (existing) sits alongside it.
- **Shoot → "Queue drop"** drafts a Communities message announcing the content,
  dated a few days after the shoot.
- **Campaign detail → "Masterclasses & webinars"** section lists events linked to
  the campaign and a **"+ Schedule a masterclass"** button creates one already
  linked and jumps to the Events tab.

## 3. Content Library (CMS) — new "Content" tab
- A filterable gallery of assets: **courses, videos, infographics, banners**.
- **Add by link** (Canva / YouTube / Vimeo — type auto-detected, YouTube
  thumbnail auto-pulled) **or upload a file** (local Adobe exports → Asana
  attachment, ≤8 MB; big video should stay as a link).
- Each asset has **type, status (idea→draft→review→approved→published), owner,
  tags**, and **links to a campaign / event / shoot**.
- Search + type + status filters double as the **reuse finder** when planning.
- Stored as JSON in one managed Asana task, `⚙️ content-library`, like the
  events data. New module: `js/content-library.js`.

## 4. Reports — new "Reports" tab
- Link-out cards to the live dashboards:
  - Leaderboard — https://oceanbasketacademy.com/leaderboard/
  - Academy dashboard — https://oceanbasketacademy.com/
- **v2 (later):** the user has the GitHub repos + Vercel projects for both, so we
  can embed them or add a small shared endpoint to surface headline metrics
  in-app. Share the repo URLs to do that.

## Notes
- Nav is now 13 tabs — worth grouping in a future pass.
- All 26 files pass `npm run check`; verified in demo with zero console errors.
