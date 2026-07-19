# Campaign Operating Suite — installation and use

This build extends the Campaigns tab into a campaign operating layer while keeping Asana as the source of truth.

## The most important design choice

A linked item is **one Asana task with more than one project membership**.

For example, a Summer Menu shoot remains on the Content & Comms board and is also added to the Summer Menu campaign project. It is not copied. Completing it, changing its date, changing its assignee, or commenting on it updates the same task everywhere.

The Campaign selector is now available when creating or editing:

- ordinary tasks;
- shoot days and their invite/store-call companion tasks;
- generated shot lists, approved shoot ideas and supplier briefs;
- events and masterclasses;
- Skills Boosters;
- Community messages.

Existing tasks can be linked or unlinked through the task drawer under **Campaign link**.

## Campaign health

The status is rule-based, not an unexplained AI score:

- **On track** — no material warning was found.
- **Needs attention** — preparation or data hygiene needs work.
- **At risk** — overdue work or a campaign that ended with open work.

The checks include:

- overdue work;
- missing owner, dates, assignees, or task dates;
- launch within 7 days without a Community message;
- launch within 14 days without a shoot, brief, or content item;
- no milestones;
- campaign ended without a saved wrap-up.

Each warning links to the most useful place to fix it where possible.

## Campaign templates

The **+ Campaign** workflow now begins with a template:

1. Menu launch
2. Learning programme
3. Incentive / sales campaign
4. Masterclass / event
5. Store opening
6. Small communications campaign
7. Blank campaign

The app drafts a right-sized runway. Every row can be edited, unticked, or changed between a normal task and an Asana milestone before creation. Nothing is created until **Create it all in Asana** is pressed.

## Milestones

Milestones are native Asana milestone tasks. They are shown separately at the top of a campaign, marked with a diamond on calendars, and remain visible in the normal task timeline.

## Decision log

Each decision is stored as a real task in the campaign's **Campaign HQ** section. The task records:

- decision;
- date;
- who decided;
- reason;
- operational impact.

This makes decisions searchable in Asana and usable in the final wrap-up.

## Campaign wrap-up

**Draft from campaign history** uses actual tasks, milestones, completion state, overdue work, and decision records. The result is fully editable before it is saved back to the campaign as an Asana task.

When AI is unavailable, the app generates a factual fallback rather than failing.

## Safe campaign management

The actions deliberately have different levels of impact:

1. **Hide from Command Center** — local display preference only. Asana and the portfolio are untouched.
2. **Remove from portfolio** — the Asana project survives but leaves the portfolio.
3. **Archive Asana project** — preserves read-only history and removes it from active work.
4. **Permanently delete project** — destructive and protected by an exact-name confirmation.

No live campaign was archived or deleted while this build was created.

## Mobile navigation

On narrow screens the main destinations are:

- Calendar
- Girls
- Campaigns
- More

The remaining tabs are available from **More**. This prevents the full desktop tab row from crushing the phone layout. The bottom bar stays fixed and the page has no horizontal overflow.

## Install this version

Replace the matching files in your existing project folder with the files in the supplied full-project ZIP. Do not omit these files:

- `js/campaigns.js`
- `js/core.js`
- `js/drawer.js`
- `js/content.js`
- `js/communities.js`
- `js/demo.js`
- `js/calendar.js`
- `api/asana.js`
- `index.html`
- `styles.css`

`index.html` uses cache version `20260719a`, so deployed browsers fetch the matching JavaScript and CSS instead of mixing old and new files.

## Validate, commit and deploy

Run this from the project folder on your Mac:

```bash
node --check js/core.js
node --check js/campaigns.js
node --check js/drawer.js
node --check js/content.js
node --check js/communities.js
node --check js/demo.js
node --check api/asana.js

git status
git add -A
git commit -m "Add full campaign operating suite"
git push origin main
```

Your Vercel project watches GitHub `main`, so the push triggers the deployment. After Vercel shows **Ready**, hard-refresh the live app with `Command + Shift + R`.

## First live smoke test

Use a harmless test campaign or an existing campaign where note edits are safe:

1. Open Campaigns and confirm the portfolio appears.
2. Edit one working-note sentence and save it.
3. Create a small task and select **Milestone**.
4. Create a test Community message linked to that campaign.
5. Confirm the same task appears in Communities and Campaigns, then delete the test task in Asana.
6. Log a test decision, open it in Asana, then delete it if it was only for testing.
7. Open the app on a phone and confirm the four-item bottom navigation appears.

This verifies the signed-in user's Asana permissions for project updates, multi-project membership, milestones, and portfolio access.
