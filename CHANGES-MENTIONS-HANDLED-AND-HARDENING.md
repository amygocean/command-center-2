# Mentions "Handled → History" + whole-app hardening

A batch of improvements across UI, safety, speed and the Mentions feature.

## Mentions
- **Handled state + History tab.** Every open mention can now be marked
  **✓ Handled**, which clears it from the **All** inbox and files it under a new
  **History** tab (tabs are now All / History / Hidden). Handled threads show a
  "Handled" tag and can be **↩ Reopened** back into the inbox. The `@` badge and
  the "new" counts ignore handled mentions.
- **Clear inbox.** One button marks every open mention handled at once.
- **Inline reply.** Expand a thread and reply straight from the panel — it posts
  a comment to the source task (@-mentioning whoever mentioned you) and moves the
  thread to History, without opening the drawer.
- **Person filter.** Filter the panel by who mentioned you.
- **Keyboard nav.** ↑/↓ move between threads, Enter/Space expands.
- **Correctness.** Outgoing @mentions now include `data-asana-type="user"` to
  match Asana's own format (and what our reader parses back).
- Triage state (`seen` / `hidden` / `handled`) is saved per user in
  `ob-mention-triage-v1`.

## Safety (so it won't break)
- **Concurrency-safe shared state.** `save_dashboard_state` now merges each
  edit into the latest server copy (server-side, in `api/asana.js`), so two
  people editing The Girls / corkboard at the same time no longer overwrite each
  other. Each person's own lane wins; everyone else's concurrent edits are kept.
  Any parse/read hiccup falls back to the old overwrite, so behaviour is never
  worse than before.
- **AI endpoint guarded.** `api/ai.js` now caps forwarded content (~60k chars)
  and rate-limits each user (20 req/min) so a huge paste or a runaway loop can't
  burn the AI budget.
- **Auto cache-busting.** `scripts/stamp-version.mjs` (wired to `vercel-build`)
  stamps every asset `?v=` with the git SHA on each deploy, so a stale
  `core.js` / `styles.css` can never be served after a release.
- **Config backup.** The last good `cfg` is saved to `*_backup`; a corrupt
  localStorage now restores from it instead of silently resetting to defaults.

## Speed
- **Lighter background mention scans.** Incremental (5-min poll) scans skip the
  heavy project-wide search and read fewer story pages; the full project scan
  still runs on first load and Deep scan. A short in-memory server cache lets a
  user's open tabs share one scan.
- **Poll backoff.** When the Mentions panel is closed, the background refresh
  runs ~every 15 min instead of every 5.

## UI / accessibility
- Icon-only header buttons (`@`, `💡`, `⚙︎`, sign-out) now have `aria-label`s.
- Long tab intros clamp to two lines with a **more / less** toggle.
