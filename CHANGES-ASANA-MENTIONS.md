# Real Asana Mentions

## What changed

The header **@** panel now shows real places where the signed-in person was
mentioned in Asana task comments, including tasks outside the Academy boards
already loaded into the app.

Each mention includes:

- Who mentioned you
- The task name
- The actual comment excerpt
- The task's project when available
- The mention date or time
- A direct route to the source task

When the source task is already loaded in the Command Center, it opens in the
normal task drawer. Otherwise it opens directly in Asana.

## How the scan works

Asana does not expose the user's Inbox through its public API. The app therefore:

1. Searches recently modified tasks followed by the signed-in user.
2. Reads their comment stories in batches.
3. Detects Asana's structured rich-text user links for the signed-in user's GID.
4. Returns the newest 60 mentions from the last 180 days.

Mentions created from inside this app are merged into the list immediately while
Asana's search index catches up.

## Performance and privacy

- Results are cached in that person's browser for five minutes.
- The scan uses the signed-in person's own Asana OAuth session.
- The cache is stored separately per Asana user.
- No additional environment variable or API key is required.
- A manual **Refresh** button is available in the Mentions panel.
- The panel also includes a direct link to the full Asana Inbox.

## Honest limitations

- The public API does not provide an exact unread Inbox count.
- The panel scans task-comment mentions, not every possible Asana notification.
- Results are limited to recently active collaborator tasks from the last six months.
- If Asana task search is unavailable for the account, the panel continues to
  show mentions made from within the Command Center and explains the limitation.
