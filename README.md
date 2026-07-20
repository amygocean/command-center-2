# Ocean Basket Academy — Command Center (hosted version)

This is the team-accessible version of the Command Center. It's the same dashboard you've been using, rebuilt so **Amy, Caitlin and Jess each open it in their own browser** at a real web address and sign in with their own Asana account.

It runs on **Vercel's free tier** — no Azure, no SharePoint, no servers to manage. Total moving parts: this code, an Asana "developer app" (for sign-in), and optionally an Anthropic key (for the AI suggestions).

If any step feels technical, this is the natural place to hand it to a lightly-technical colleague — but it's written so you can do it yourself in about 30 minutes.

---

## What you'll need

- A **Vercel** account (free) — sign up at vercel.com with your GitHub or email.
- **Asana admin access** to create a developer app (to get the sign-in keys). If you're not an admin, ask whoever is.
- *(Optional)* An **Anthropic API key** from console.anthropic.com — only needed if you want the AI content suggestions and chat summaries. Leave it out and everything else still works.

---

## Step 1 — Create the Asana sign-in app

1. Go to **https://app.asana.com/0/my-apps** → **Create new app** (or "+ Create app").
2. Name it `Academy Command Center`.
3. Note the **Client ID** and **Client Secret** (you'll paste them into Vercel in Step 3). Keep the secret private.
4. Leave the redirect URL for now — you'll add it in Step 4 once you know your web address.

## Step 2 — Put the code on Vercel

**Easiest (drag-and-drop):**
1. Install the Vercel CLI is *not* required for this route. Instead, go to **vercel.com → Add New → Project → Deploy a template / Import**, or use the CLI route below.

**Recommended (CLI, 3 commands):**
1. Install Node.js (nodejs.org) if you don't have it.
2. In a terminal, `cd` into this folder and run:
   ```
   npm i -g vercel
   vercel
   ```
3. Answer the prompts (accept the defaults). Vercel gives you a URL like `https://academy-command-center.vercel.app`. Copy it.

## Step 3 — Add the environment variables

In the Vercel dashboard → your project → **Settings → Environment Variables**, add each of these (see `.env.example`):

| Name | Value |
|---|---|
| `ASANA_CLIENT_ID` | from Step 1 |
| `ASANA_CLIENT_SECRET` | from Step 1 |
| `APP_URL` | your Vercel URL from Step 2 (no trailing slash) |
| `ASANA_WORKSPACE` | `14491666778313` (Ocean Basket) |
| `ANTHROPIC_API_KEY` | your Anthropic key, or leave blank to turn AI off |
| `SESSION_SECRET` | any long random string (mash the keyboard) |
| `ASANA_SHARED_PAT` | a PAT that can access the shared Academy boards; falls back to `AMY_PAT` if omitted |

## Step 4 — Point Asana back at your app

1. Back in the Asana app (Step 1), under **OAuth → Redirect URLs**, add exactly:
   ```
   https://YOUR-VERCEL-URL/api/auth/callback
   ```
   (replace with your real URL).
2. In Vercel, **redeploy** so the new environment variables take effect (Deployments → ⋯ → Redeploy).

## Step 5 — Sign in and add the team

1. Open your Vercel URL. You'll see **"Sign in with Asana."** Sign in — the dashboard loads with your live boards.
2. **Caitlin and Jess** just visit the same URL and sign in with *their* Asana. Ordinary task changes still use each person's own login. Shared app data—The Girls layout, Corkboard and PR pipeline—uses `ASANA_SHARED_PAT` so the team sees one consistent version. No passwords to share.

That's it — the team now has the Command Center at a shared web address.

---

## Turning the AI on or off

The **✨ content suggestions** and the **Communities chat summariser** use Anthropic. If `ANTHROPIC_API_KEY` is set they work; if it's blank, the rest of the dashboard runs normally and those buttons just say AI is off. You can change the model via an optional `AI_MODEL` variable.

## Adding the Outlook inbox later (v2)

This build deliberately leaves out the Outlook inbox monitoring, because it's waiting on your Microsoft admin approval. When that's ready it slots in as a new `Inbox` tab plus a `/api/outlook` function using Microsoft Graph — the handover document (`Command-Center-Copilot-Handover.docx`) describes exactly how. Nothing here needs to change to add it.

---

## How it's built (so you can learn it)

```
Browser
  index.html        the shell
  styles.css        the "Ocean Light" design system
  js/data.js        Asana ids, occasions list, brief template, defaults
  js/core.js        state, config, API plumbing, greeting, suggestions tray
  js/calendar.js    zoomable calendar (day → scrollable year)
  js/people.js      crew lanes, auto-saved sections/order + shared Corkboard
  js/content.js     Studio: shoots, prep kits, AI ideas & supplier briefs
  js/communities.js WhatsApp planner linked to the fixed Communities board
  js/drawer.js      task drawer + modals + campaign playbook generator
  js/friday.js      the Friday Huddle
  js/news.js        News tab (weekly web-searched reading list)
  js/pr.js          shared PR pipeline for the full Academy team
  js/demo.js        ?demo=1 canned data (previews & demos, no Asana needed)
   │  fetch()
   ▼
/api/asana   → talks to Asana as the signed-in user or shared-board identity
/api/ai      → talks to Anthropic (key stays server-side)
/api/news    → Anthropic + web search: curates the weekly News tab
/api/digest  → weekday 07:30 cron: emails the morning brief (see .env.example)
/api/auth/*  → Asana sign-in (OAuth); stores tokens in a secure cookie
```

**The morning digest email** is off until you add four env vars in Vercel
(`ASANA_PAT`, `RESEND_API_KEY`, `DIGEST_TO`, plus the existing
`ANTHROPIC_API_KEY`) — see `.env.example`. Once set, everyone on `DIGEST_TO`
gets the brief at 07:30 SAST on weekdays without opening the app.

**Try it without signing in:** open `YOUR-URL/?demo=1` (or locally: `node serve.cjs`
then `http://localhost:3999/?demo=1`) — the whole dashboard runs on sample data.
Great for showing people around; nothing is written anywhere.

**Notes on the smart bits:**
- The Girls sections, exact task order, hidden/private choices, Corkboard and
  shared board ids live in a hidden Asana task called
  `⚙️ dashboard-state (do not delete)` on the Day-to-Day board. Every change is
  cached in the browser immediately, then synced to Asana with automatic retry.
- Prep-kit tasks are named `「prep」 … — <shoot name>` so the app can track them.
- Communities uses the existing Asana project `1216476690596926`; the app no
  longer creates a second message board. Each community is a section, and
  message purpose is stored as `#purpose:<tag>` in the task notes.
- The OB Fit month bar reads the Curriculum board when tasks are named
  `January: <focus>` etc. — edit there or in Settings, both stay in sync.
- Holidays/occasions (ZA · CY · UK + food days) live in `js/data.js`, not Asana.

The clever bit: the dashboard still calls the same verb names it always did — `get_tasks`, `update_tasks`, `create_project`, and so on. `api/asana.js` simply maps each verb to the matching Asana REST call. That's why almost none of the dashboard's own code had to change — only the one function that used to talk to the Claude bridge now talks to `/api/asana` instead.

Your Asana tokens live in an **httpOnly cookie** — the browser holds it but page JavaScript can't read it, and secrets (the Asana client secret, the Anthropic key) exist **only on the server**, never in the browser.

## Costs

- **Vercel** free tier is plenty for a small team.
- **Anthropic** is pay-as-you-go and tiny at this usage (a few suggestions/summaries a day is cents). Skip the key to pay nothing.
- **Asana** — no extra cost; uses your existing workspace.

## Security notes

- Keep individual Asana sign-in for ordinary work. Use `ASANA_SHARED_PAT` only
  for app-wide shared state and boards that genuinely need one consistent view.
- Any Asana personal access tokens shared informally in the past should be **revoked and regenerated** (app.asana.com/0/my-apps).
- Keep the Client Secret, Session Secret and Anthropic key only in Vercel's environment variables — never in the code or in chat.

## Troubleshooting

- **"Sign in failed (state mismatch)"** — your `APP_URL` or the Asana redirect URL don't match exactly. They must be the same host, with `/api/auth/callback` on the redirect.
- **Dashboard loads but no tasks** — check the signed-in Asana account is a member of the boards; confirm `ASANA_WORKSPACE` is correct.
- **AI buttons say it's off** — `ANTHROPIC_API_KEY` isn't set (or you need to redeploy after adding it).
- **Anything 500s** — Vercel → your project → Logs shows the error from the function.

---

*Companion files: `Command-Center-Copilot-Handover.docx` (architecture & roadmap) and `command-center.html` (the original prototype).*
