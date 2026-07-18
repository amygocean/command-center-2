// ------------------------------------------------------------------
//  /api/digest — the morning brief, delivered by email.
//  Runs on a Vercel cron (see vercel.json) at 07:30 SAST on weekdays.
//  Needs four env vars, all optional — if any is missing the run is
//  skipped quietly, so the rest of the app is unaffected:
//    ASANA_PAT          personal access token (app.asana.com/0/my-apps)
//    ANTHROPIC_API_KEY  already set if AI features are on
//    RESEND_API_KEY     from resend.com (free tier is plenty)
//    DIGEST_TO          comma-separated recipient emails
//  Optional: DIGEST_FROM (verified sender), CRON_SECRET (protects the URL)
// ------------------------------------------------------------------

const PROJECTS = [
  ["1213750988186400", "Content & Comms"],
  ["1213797897707123", "Team Scheduling"],
  ["1214196027560535", "Menu Training"],
  ["1214196027560612", "New/Revamped Restaurant Training"],
  ["1216476678698201", "Academy WhatsApp"],
  ["1216637913085208", "Day to Day"],
  ["1216638197844781", "Volume Drivers"],
  ["1213806179626680", "Store Visits"]
];

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" }); return;
  }
  const pat = process.env.ASANA_PAT, ai = process.env.ANTHROPIC_API_KEY;
  const resend = process.env.RESEND_API_KEY, to = process.env.DIGEST_TO;
  const missing = [!pat && "ASANA_PAT", !ai && "ANTHROPIC_API_KEY", !resend && "RESEND_API_KEY", !to && "DIGEST_TO"].filter(Boolean);
  if (missing.length) { res.status(200).json({ skipped: "missing env: " + missing.join(", ") }); return; }

  try {
    // 1. Pull the relevant slice of Asana
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const soon = new Date(today); soon.setDate(soon.getDate() + 7);
    const iso = d => d.toISOString().slice(0, 10);
    const all = [];
    for (const [gid, name] of PROJECTS) {
      const r = await fetch(`https://app.asana.com/api/1.0/tasks?project=${gid}&limit=100&opt_fields=name,due_on,completed,assignee.name`,
        { headers: { Authorization: `Bearer ${pat}` } });
      const j = await r.json();
      (j.data || []).forEach(t => { if (!t.completed && t.due_on) all.push({ ...t, board: name }); });
    }
    const overdue = all.filter(t => t.due_on < iso(today) && !/^「/.test(t.name));
    const week = all.filter(t => t.due_on >= iso(today) && t.due_on <= iso(soon) && !/^「brief」|^「shot」/.test(t.name));
    const comms = week.filter(t => t.board === "Academy WhatsApp");
    const shoots = all.filter(t => /^shoot day/i.test(t.name)).sort((a, b) => a.due_on < b.due_on ? -1 : 1).slice(0, 2);

    // 2. Write the brief
    const ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ai, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-5", max_tokens: 700,
        messages: [{
          role: "user",
          content: "You are the ops sidekick for the Ocean Basket Academy team (internal, warm, concise, minimal emoji). Write a morning email brief: the headline for the week, today at a glance, 3-5 bullets for the week ahead, and one gentle nudge if anything is overdue or a shoot is close. Under 160 words, plain text.\n\nDATA:\n" +
            JSON.stringify({ today: iso(today), this_week: week, overdue, whatsapp_going_out: comms, upcoming_shoots: shoots })
        }]
      })
    });
    const aj = await ar.json();
    if (!ar.ok) throw new Error((aj.error && aj.error.message) || "AI error");
    const text = (aj.content || []).map(b => b.text || "").join("").trim();

    // 3. Send it
    const day = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const er = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.DIGEST_FROM || "Command Center <onboarding@resend.dev>",
        to: to.split(",").map(s => s.trim()),
        subject: "Academy brief — " + day,
        text: text + "\n\n—\nSent by the Command Center every weekday at 07:30."
      })
    });
    const ej = await er.json();
    if (!er.ok) throw new Error((ej.message) || "email error");
    res.status(200).json({ sent: true, id: ej.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
