// ------------------------------------------------------------------
//  /api/pitch — the PR pitch radar (Amy's tab).
//  Web-searches for publications, podcasts, conferences and journalists
//  worth pitching, with angles tailored to what the Academy is doing
//  right now (passed in the request body as `context`).
//  Uses OPENAI_API_KEY (falls back to ANTHROPIC_API_KEY).
// ------------------------------------------------------------------
import { readSession } from "./_lib.js";

async function readBody(req){
  if(req.body && typeof req.body==="object") return req.body;
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString()||"{}"); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!readSession(req)) { res.status(401).json({ error: "not authenticated" }); return; }

  const oaKey = process.env.OPENAI_API_KEY;
  const anKey = process.env.ANTHROPIC_API_KEY;
  if (!oaKey && !anKey) { res.status(200).json({ off: true, error: "Pitch radar needs OPENAI_API_KEY (or ANTHROPIC_API_KEY)." }); return; }

  const { context } = await readBody(req);
  const todayStr = new Date().toISOString().slice(0,10);
  const prompt =
    "You are a PR strategist for Ocean Basket Academy — the L&D function of a seafood restaurant franchise (South Africa & Cyprus). Their external narrative: digital transformation without leaving frontline workers behind; WhatsApp-based training for deskless, multilingual restaurant crews; Jessica Pallister is being positioned as a speaker (topic: From Courses to Capability).\n\n" +
    "What they're working on right now:\n" + JSON.stringify(context || {}) + "\n\n" +
    "Today's date is " + todayStr + ". Only suggest opportunities that are still open and in the future — never a conference, CFP or award whose date or deadline has passed; verify dates when you search.\n\n" +
    "Search the web for CURRENT, real pitching opportunities: L&D and HR publications, podcasts, conference CFPs, awards, and journalists covering frontline/deskless workforce topics. Prefer South Africa, UK and global English-language outlets. For each, craft a specific angle tied to what they're working on.\n\n" +
    "Return ONLY a JSON object:\n" +
    '{"picks":[{"outlet":"name","type":"publication|podcast|conference|award|journalist","url":"...","angle":"one-sentence tailored pitch angle","why":"one line on fit/timing"}]}\n' +
    "6-10 picks, best first.";

  try {
    let text = "";
    if (oaKey) {
      let r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${oaKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o", tools: [{ type: "web_search" }], input: prompt })
      });
      let j = await r.json();
      if (!r.ok && j.error && /web_search/.test(j.error.message || "")) {
        r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${oaKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o", tools: [{ type: "web_search_preview" }], input: prompt })
        });
        j = await r.json();
      }
      if (!r.ok) { res.status(502).json({ error: (j.error && j.error.message) || "OpenAI error" }); return; }
      text = j.output_text || (j.output || []).filter(o => o.type === "message")
        .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text)).join("");
    } else {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "claude-sonnet-5", max_tokens: 3000,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
          messages: [{ role: "user", content: prompt }]
        })
      });
      const j = await r.json();
      if (!r.ok) { res.status(502).json({ error: (j.error && j.error.message) || "AI error" }); return; }
      text = (j.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    }
    const m = (text || "").match(/\{[\s\S]*\}/);
    let picks = [];
    if (m) { try { picks = (JSON.parse(m[0]).picks || []).filter(p => p && p.outlet); } catch {} }
    res.status(200).json({ picks, fetched: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
