# Real Asana Mentions — deeper subtask scan

## Why the first version could miss genuine mentions

The original panel searched only a limited group of recently followed tasks and
then read the first page of comments. Two failures were hidden:

- subtasks were not searched as their own task type;
- comment-reading errors were silently treated as "no mentions".

That could produce an empty panel even when the signed-in person had genuinely
been @mentioned.

## What changed

The **@** panel now reconstructs task-comment mentions through several paths:

1. recent followed top-level tasks;
2. recent followed subtasks, using Asana's explicit `is_subtask=true` filter;
3. recent tasks from the Academy projects loaded by the Command Center;
4. direct subtask discovery from recent parent tasks, including subtasks that
   are not independently added to a project;
5. browser-loaded tasks as immediate seeds while Asana search indexing catches up.

For every candidate task or subtask, the server reads paginated comment stories
and matches the signed-in user's exact Asana GID in the structured rich-text
mention link.

## Better failure handling

- Comment reads first use the signed-in person's OAuth session.
- When available, `ASANA_SHARED_PAT` is used as a fallback for Academy work the
  shared identity can access.
- The panel now reports how many tasks, subtasks and comments were scanned.
- Permission, task-search and Stories-scope failures are shown as warnings
  instead of being converted into a false empty result.
- The browser cache key was changed, so an empty result saved by the old scanner
  is not reused after deployment.

## What the panel shows

Each result includes:

- who mentioned you;
- the real comment excerpt;
- the task or subtask name;
- the parent task for subtasks;
- the project when available;
- the mention date;
- a direct route to the task in the app or Asana.

## Honest boundary

Asana does not expose the Inbox notification feed through this API workflow.
The panel reconstructs genuine user mentions from accessible task and subtask
comments from the last 180 days. It cannot show comments on work that neither
the signed-in person nor the configured shared Asana identity may read.
