# Deploy — the detailed walkthrough

This is the hand-holding version. No terminal needed — you'll do everything in your browser using **GitHub** (to hold the code) and **Vercel** (to run it). Budget about 30–40 minutes the first time.

Before you start, **unzip `command-center-hosted.zip`** somewhere you can find it (e.g. your Desktop). You should see a folder containing `index.html`, `package.json`, `vercel.json`, an `api` folder, and these guide files.

You'll collect a few values along the way — keep a blank note open and paste them in as you go:

- Asana **Client ID**
- Asana **Client Secret**
- Your **web address** (you get this in Step 3)
- An **OpenAI or Anthropic key** (optional)
- A **random secret** (just mash your keyboard, e.g. `k39fjs82hslq0alabel99xzz`)

---

## STEP 1 — Create the Asana sign-in app

This gives the app permission to let people sign in with Asana.

1. Go to **https://app.asana.com/0/my-apps** (sign in to Asana if asked).
2. Click **Create new app** (or **+ Create app**).
3. Name it **Academy Command Center**. If it asks what kind of app, choose the OAuth / general option and continue.
4. You'll land on the app's settings page. Find and copy two things into your note:
   - **Client ID** (a long number)
   - **Client secret** — you may need to click "Show" or "Generate". Copy it now; treat it like a password.
5. Leave this tab open — you'll come back in Step 6 to add the redirect URL (you need your web address first).

> If you don't see "Create new app," you may not have developer access. Ask whoever administers your Asana.

---

## STEP 2 — Put the code on GitHub

GitHub is just online storage for the code, which Vercel reads from.

1. Go to **https://github.com** and sign in (create a free account if you don't have one).
2. Top-right, click the **+** → **New repository**.
3. Name it `academy-command-center`. Set it to **Private**. Leave everything else as-is. Click **Create repository**.
4. On the next page you'll see a link that says **"uploading an existing file"** — click it. (Or use the **Add file → Upload files** button.)
5. Open your unzipped `command-center-hosted` folder. **Select everything inside it** (the `index.html` file, the `api` folder, `package.json`, `vercel.json`, `.gitignore`, `.env.example`, and the guide files) and **drag it all onto the GitHub upload area.**
   - Important: drag the **contents**, not the outer folder — GitHub should list `index.html`, `api/…`, `package.json`, etc.
6. Scroll down and click **Commit changes**.
7. You should now see your files listed in the repository. Done.

---

## STEP 3 — Deploy to Vercel

1. Go to **https://vercel.com** and click **Sign Up** (or Log in). Choose **Continue with GitHub** — this links the two automatically.
2. Once in, click **Add New… → Project**.
3. You'll see a list of your GitHub repositories. Find **academy-command-center** and click **Import**.
4. On the configure screen, **don't change anything** — Vercel detects it automatically. (If it asks for a "Framework Preset," leave it as **Other**.)
5. Click **Deploy**.
6. Wait ~1 minute. When it finishes you'll see a **Congratulations** screen with a preview and a URL like `https://academy-command-center.vercel.app`. **Copy that URL into your note** — this is your web address.

At this point the app is live but not yet working — it still needs its settings (next step). If you open it now you'll likely get a sign-in error. That's expected.

---

## STEP 4 — Add the settings (environment variables)

These tell the app its keys and address. This is the most important step — type carefully.

1. In Vercel, open your project, then go to **Settings** (top menu) → **Environment Variables** (left menu).
2. Add each row below: type the **Name** exactly, paste the **Value**, make sure all three environment boxes (Production / Preview / Development) are ticked, and click **Save** after each.

   | Name | Value |
   |---|---|
   | `ASANA_CLIENT_ID` | the Client ID from Step 1 |
   | `ASANA_CLIENT_SECRET` | the Client Secret from Step 1 |
   | `APP_URL` | your web address from Step 3 — **no slash at the end** |
   | `ASANA_WORKSPACE` | `14491666778313` |
   | `OPENAI_API_KEY` | your OpenAI key (optional; use this or Anthropic) |
   | `ANTHROPIC_API_KEY` | your Anthropic key (optional; use this or OpenAI) |
   | `SESSION_SECRET` | your random keyboard-mash string |
   | `ASANA_SHARED_PAT` | shared Academy PAT used for team campaign projects, resources and shared app state |

   Double-check `APP_URL` has **no trailing slash** — `https://academy-command-center.vercel.app` ✅, not `…app/` ❌.

3. *(Optional — the AI key.)* Add either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` if you want Smart Campaign source analysis and other AI suggestions. You can add this later. Do not add both unless you deliberately want OpenAI to be preferred for Smart Campaigns.
4. Add `ASANA_SHARED_PAT` using an Asana personal access token from an Academy account that can edit the shared boards and campaign projects. This prevents shared resources and Smart Plans from depending on the permissions of whichever teammate happens to be signed in.

---

## STEP 5 — Redeploy so the settings take effect

Environment variables only apply to a fresh deploy.

1. In Vercel, go to the **Deployments** tab.
2. On the most recent deployment, click the **⋯** (three dots) on the right → **Redeploy** → confirm **Redeploy**.
3. Wait ~1 minute for it to finish.

---

## STEP 6 — Point Asana back at your app

Now Asana needs to know where to send people after they sign in.

1. Go back to your Asana app tab from Step 1 (or reopen **https://app.asana.com/0/my-apps** → your app).
2. Find the **OAuth** section and the **Redirect URLs** (sometimes "Redirect URIs") field.
3. Add exactly this, using your web address:
   ```
   https://YOUR-WEB-ADDRESS/api/auth/callback
   ```
   For example: `https://academy-command-center.vercel.app/api/auth/callback`
4. Save.

> It must match your `APP_URL` exactly, with `/api/auth/callback` on the end. A mismatch here is the #1 cause of sign-in errors.

---

## STEP 7 — Sign in and add the team

1. Open your web address in the browser.
2. You'll see **"Sign in with Asana."** Click it, approve when Asana asks, and the dashboard should load with your live boards. 🎉
3. **Add Caitlin and Jess:** just send them the web address. Each of them opens it, clicks **Sign in with Asana**, approves, and they're in — seeing what their own Asana permissions allow. No passwords to share.

---

## If something goes wrong

- **"Sign in failed (state mismatch)."** Your `APP_URL` (Step 4) and the Asana redirect URL (Step 6) don't match exactly. Check both — same address, `/api/auth/callback` on the redirect, no trailing slash on `APP_URL`. Fix, then redeploy (Step 5).
- **A page error / 500.** In Vercel, open your project → **Logs** (or **Deployments → the deployment → Functions/Logs**). It shows the exact error. Send me the message and I'll fix it.
- **Signs in but no tasks show.** Make sure the Asana account you signed in with is a member of the boards. Confirm `ASANA_WORKSPACE` is `14491666778313`.
- **The ✨ AI buttons say AI is off.** Neither `OPENAI_API_KEY` nor `ANTHROPIC_API_KEY` is set, or you added one but have not redeployed (Step 5).
- **You changed a setting and nothing changed.** Almost always: you need to **redeploy** (Step 5) for env-var changes to apply.

---

## Making changes later

When you (or I) improve the dashboard, the update flow is: replace the changed file in your GitHub repo (**Add file → Upload files**, or edit in place), commit — and Vercel automatically redeploys within a minute. No steps 1–6 to redo.

## A note on the terminal route

If you'd rather not use GitHub, there's a 3-command terminal version in `README.md` (install Node, `npm i -g vercel`, `vercel`). The GitHub route above is friendlier if you're not used to a terminal, and has the bonus that future updates auto-deploy.
