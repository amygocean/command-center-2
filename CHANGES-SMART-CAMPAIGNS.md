# Smart Campaigns — launch-anchored planning and source intelligence

## What was added

- Campaign creation now starts with a required launch date and calculates the work backwards from it.
- The standard runway includes course release 14 days before launch and the main shoot day 28 days before launch.
- Initial source files can be queued while creating the campaign.
- Existing campaigns now have **Plan & tasks**, **Resources** and **Smart Plan** views.
- Resources are attached to the Asana campaign project and can be added, opened, removed or reanalysed later.
- Supported smart-reading formats: PDF, DOCX, XLSX, CSV, TXT, JSON, JPG and PNG.
- Source analysis identifies grounded facts, recipes, shoot requirements, audiences, risks, missing information and proposed outputs.
- **Smart update whole plan** compares a regenerated plan with existing campaign work after sources or campaign details change.
- Smart Update never silently rewrites the campaign: only checked, approved changes are applied.
- Completed work is preserved and deliberately dismissed suggestions remain dismissed.
- Campaign deliverables can be assigned to an existing or new Studio shoot day while remaining one shared Asana task.

## Shared storage

Original files remain in the Asana project’s Key Resources. Source analyses, generated recommendations and review decisions are saved in one managed task named `⚙️ campaign-smart-plan (managed by app)` inside the campaign project.

## Environment variables

Add either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for AI analysis. Add `ASANA_SHARED_PAT` so campaign creation, resources and Smart Plan state use one dependable Academy identity.

## Safety limits

- Browser source uploads are limited to 3 MB per file.
- AI recommendations are proposals and must be approved before Asana tasks or date changes are created.
- AI is instructed not to invent operational facts; uncertainty and source conflicts are surfaced as gaps.
- Completed tasks are never moved by Smart Update.
