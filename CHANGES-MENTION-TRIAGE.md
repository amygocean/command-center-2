# Mention triage and My To-Do references

## The @ panel is now a personal inbox

The header @ button still opens Mentions in place; it does not add another main
navigation tab. The panel now opens as a right-side pop-up with a fixed header
and an independently scrollable list.

Mentions are grouped by their original Asana task or subtask and can be filtered
by:

- **New** — visible mentions that have not been acknowledged;
- **All** — every visible mention;
- **Hidden** — mentions deliberately removed from the normal list.

A search field filters by person, task, project, parent task or comment text.
Opening a thread acknowledges only that thread. Opening the panel itself no
longer marks everything seen. **Mark all seen** remains an explicit action.

## Hide and restore

**Hide** removes the currently known mentions in that task thread from the
regular list and badge count. Hidden mentions remain recoverable. If somebody
mentions the user again on that task later, the new comment appears normally;
hiding an old thread does not permanently mute the task.

Seen and hidden states are personal browser preferences. They do not alter the
Asana task, comment or Asana Inbox state.

## Show in My To-Do

**Show in My To-Do** adds a lightweight linked reference to the signed-in
person's column in The Girls. It does not:

- create a duplicate Asana task;
- move the original task to another project;
- reassign the original task;
- complete or edit the original task.

The reference is stored in the shared dashboard-state record so it survives
refreshes and another browser, but it is rendered only for the signed-in user.
It can be reordered and placed in the person's normal Girls sections.

Clicking the reference loads the original task into the normal task drawer,
including the mention context. The user can then read or post comments and open
the original in Asana. Ticking the reference in The Girls means “I handled this
mention”; it removes the reference without completing the source task.

When the source task is already in that person's real Asana My Tasks, the app
adds an **@ mention** marker to the existing card rather than creating a second
card.

## Faster checks and new-mention alerts

Cached results display immediately. Normal refreshes use the last successful
scan time and inspect only recently changed work, with a 15-minute overlap for
Asana indexing delays. **Deep scan** remains available to reconstruct the full
six-month history.

While the app is open it checks every five minutes and when the browser tab
becomes active again. Newly discovered mentions:

- increase the @ badge;
- briefly animate the @ button;
- show an in-app toast.

A legacy timestamp from the older mention panel is respected during migration,
so deploying this version does not incorrectly mark the entire six-month
history as new.
