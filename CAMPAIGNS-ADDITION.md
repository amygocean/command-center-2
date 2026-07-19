# Campaigns addition

This build adds a portfolio-backed Campaigns workspace to the Academy Command Center.

## What changed

- New **Campaigns** tab.
- Reads projects from Asana portfolio `1216656052977768`.
- Each portfolio project becomes a campaign in the app and a campaign layer on the main calendar.
- New campaign creation now:
  1. creates a real Asana project;
  2. creates Pre-launch, Launch week, In market and Wrap-up sections;
  3. creates the approved playbook tasks;
  4. adds the project to the campaign portfolio;
  5. opens the campaign in the new tab.
- Edit campaign name, dates and working notes from the app. These save to the Asana project.
- Add campaign tasks with date, phase and assignee.
- Expand any task and create/check off subtasks.
- Compact campaign calendar with campaign range and task markers.
- Upcoming campaign tasks remain visible in the main Calendar and normal Asana task views.
- The hardcoded Volume Drivers campaign is removed/hidden from the app. The real Asana project is not deleted.
- The weekday email digest now discovers campaigns from the portfolio instead of reading the retired Volume Drivers project.
- Mobile tab navigation now scrolls inside the tab bar rather than widening the whole page.
- Asset cache version bumped to `20260718d`.

## Files changed

- `index.html`
- `styles.css`
- `js/campaigns.js` (new)
- `js/core.js`
- `js/data.js`
- `js/demo.js`
- `js/drawer.js`
- `api/asana.js`
- `api/digest.js`

## Install

Copy the full contents of this project over the matching files in your local project folder. Do not forget the new `js/campaigns.js` file.

Then run:

```bash
git status
node --check js/campaigns.js
node --check js/core.js
node --check js/drawer.js
node --check js/demo.js
git add -A
git commit -m "Add portfolio-backed Campaigns workspace"
git push origin main
```

Vercel should deploy automatically from the push to `main`.

## Verification after deployment

1. Hard refresh with `Command + Shift + R`.
2. Open **Campaigns**.
3. Confirm the campaign list matches the linked Asana portfolio.
4. Edit a harmless note and save it; confirm it appears in the Asana project description.
5. Add a small test task and subtask, then remove them in Asana if they were only for testing.
6. Create a campaign only when you are ready: this action creates a real project and real tasks.

## Testing completed here

- JavaScript syntax checks passed for every frontend and API file.
- Git whitespace validation passed.
- Demo portfolio loaded with two campaigns and no console errors.
- Campaign task creation passed.
- Campaign subtask creation passed.
- Campaign notes update passed.
- Full campaign creation passed and produced 20 playbook task rows.
- Desktop layout has no horizontal overflow.
- Mobile layout has no page-level horizontal overflow.

The live Asana response still needs a brief post-deploy check because this environment cannot access your authenticated Asana workspace.
