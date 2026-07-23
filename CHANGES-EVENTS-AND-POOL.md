# Events tab (Masterclasses & Webinars) + "Up for grabs" management

## "Up for grabs" management (personal)
- Each unassigned pool card now has a **✕** to hide it from **your** view only
  (stored per user in `ob-pool-prefs-v1`, never shared).
- **Hide column / Show** collapses the whole Up-for-grabs lane to a slim strip.
- A **"N hidden · restore"** control brings hidden cards back.
- Events no longer leak into the pool.

## Events — a dedicated tab
The old Studio "Events" strip (name-detected masterclass/webinar tasks) is
replaced by a first-class **Events** tab. Studio now holds shoot days + briefs.

- **Split tabs**: `Studio & Events` → `Studio` + new `Events`.
- **Model**: each event is a real Asana task (name + date) in Content & Comms.
  Logistics (type, format, host, sessions, roles, goal, campaign link, contacts)
  live as JSON in one managed task, `⚙️ events-data`, shared through the service
  identity like the dashboard state and campaign smart plans. The **checklist is
  real Asana subtasks**, so items are assignable and show on the boards.
- **Detection** is no longer name-based: any task we hold logistics for is an
  event (and stars on the calendar). Legacy masterclass/webinar-named tasks are
  still picked up as a fallback.
- **Editor** (per event):
  - Type: Masterclass / Webinar.
  - Format: In person / Online (Teams) / Live-shot. Choosing an online format
    reveals **Webinar hosting**: *We host on Teams* / *Bring in a crew to shoot
    live* / *Other*.
  - Food/catering toggle.
  - **Who it's for**: All roles or any of FOH / BOH / Sushi / Mgmt / Bar/Deli.
  - Free-text goal.
  - **Linked campaign** (optional) — masterclasses can belong to a campaign or not.
  - **Sessions & locations**: add multiple sessions, each with date/time/location
    (label switches to "Link / channel" for online).
  - **Checklist**: real subtasks you can tick off.
  - **Contacts**: name / role / phone-or-email.
- **Smart plan**: "Plan this event" asks the AI for a summary, a suggested run of
  show, a format-specific logistics checklist, and content/promo ideas — tailored
  to the linked campaign when set. Suggested checklist items are added as real
  subtasks with one click.
- **Campaign linkage** works from the event side (link picker); the smart plan
  pulls the campaign's name/notes for tailored suggestions.
- **Queue promo** and calendar starring carry over from the old events.

## Deliberately deferred
- **Attendance & reporting** (Phase 4) — left out for now per the brief; the model
  leaves room to add an `attendance` block and an events report later.

## Notes
- Reporting/attendance intentionally omitted.
- `js/events.js` is the new module; `renderEvents` was removed from `content.js`
  (its `queuePromoFor` / `eventHasPromo` helpers are reused by the Events tab).
