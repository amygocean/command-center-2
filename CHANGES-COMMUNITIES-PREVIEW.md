# Communities message preview and attachments

## What changed

- The Communities composer now has a short calendar/task title and a separate full WhatsApp message field.
- The full WhatsApp copy is stored in the Asana task description (`notes`).
- An optional image can be selected before queuing; it is attached to every community task created.
- Clicking a Communities message in either calendar opens a WhatsApp-style preview.
- Existing task images are loaded from Asana and shown above the message copy.
- Images can be added, replaced or removed from the preview. Replacement uploads the new image first, then removes the previous image so a failed upload cannot erase the working asset.
- Existing messages that used the task title as the copy are still supported and can be migrated into the description by saving from the preview.

## Asana integration

- Attachment listing uses `GET /attachments?parent=<task_gid>`.
- Uploads use multipart `POST /attachments`.
- Deletes use `DELETE /attachments/<attachment_gid>`.
- Shared project actions use the shared Asana identity when configured, with the signed-in user's OAuth token as the upload fallback.

## Verification

Run:

```bash
npm run check
```

The check covers syntax, the Communities link and PR safeguards, composer-to-description mapping, attachment upload wiring, preview routing, replacement cleanup, and the current Asana attachment-list route.
