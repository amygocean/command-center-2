# Shared Girls, Corkboard, PR and Communities update

## What was going wrong

The Girls layout and Corkboard were already stored in a hidden Asana task, but the browser waited before saving, ignored failed writes, and used the current viewer's Asana permissions. A refresh during that delay—or a teammate without edit access to the hidden task—could make the layout appear to reset. Corkboard notes could also be positioned beyond the visible area on a smaller screen.

PR had two separate visibility problems: the tab was hidden for everyone except Amy, and the PR project id lived in one browser's local settings. Communities could create a new project rather than consistently opening the existing shared board.

## What changed

### The Girls

- Every section, task order, hidden choice and private choice is copied to browser storage immediately.
- The same state is then synced to the hidden `⚙️ dashboard-state (do not delete)` Asana task after a short 180 ms debounce.
- Failed Asana writes retry automatically.
- A newer browser copy is recovered after a refresh and automatically pushed back to Asana.
- Dragging captures the complete order of every section and “Everything else,” rather than saving only the destination.
- Deleting a section keeps its tasks in the same order when they return to “Everything else.”

### Corkboard

- Corkboard notes use the same shared, retrying state sync.
- The Day-to-Day project is always loaded internally even when someone hides it in Settings.
- Note positions are clamped to the visible corkboard so a note placed on a wide screen remains visible on a narrower one.

### PR

- The PR tab is visible to every signed-in teammate.
- The app resolves one shared `PR & Positioning` project and stores its id in shared dashboard state.
- PR reads and writes use the shared Asana identity, so access does not depend on which teammate is viewing the app.
- The Academy team is added as a project member using Asana's current Memberships API.
- Existing local PR board settings are migrated into shared state.

### Communities

- Communities is permanently linked to project `1216476690596926`.
- The old “Create Community Messages board” setup has been removed.
- The tab includes a direct **Open Communities board** link to the supplied Asana list view.

## Deployment note

Keep `ASANA_SHARED_PAT` set in Vercel to a PAT that can edit the Day-to-Day and PR projects. When it is absent, the code falls back to `AMY_PAT`, but a dedicated shared PAT is more reliable when ownership or staff changes.

After replacing the project files, run:

```bash
npm run check
```

Then redeploy the project so the updated serverless API and cache-busted browser files go live together.
