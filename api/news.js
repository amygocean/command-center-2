// ------------------------------------------------------------------
//  /api/news — weekly reading list for the team.
//  Uses the Anthropic API's server-side web search tool to find fresh
//  articles / videos / podcasts across the department's topics, then
//  returns { summary, picks: [{title,url,source,type,topic,blurb}] }.
//  Requires ANTHROPIC_API_KEY (web search runs on Anthropic's side;
//  each refresh uses a handful of searches, capped via max_uses).
// ------------------------------------------------------------------
import { readSession } from "./_lib.js";

const TOPICS = [
  "learning & development / corporate training",
  "AI in the workplace and in learning",
  "organisational development",
  "internal communications",
  "productivity and ways of working",
  "interpersonal & professional relationships at work",
  "frontline / deskless / hospitality workforce training",
  "franchise operations and restaurant industry people trends"
];

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!readSession(req)) { res.status(401).json({ error: "not authenticated" }); return; }

  const oaKey = process.env.OPENAI_API_KEY;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!oaKey && !key) { res.status(200).json({ off: true, error: "News needs OPENAI_API_KEY (or ANTHROPIC_API_KEY) set in Vercel." }); return; }

  const prompt =
    "You curate a weekly reading list for the Ocean Basket Academy team - a three-person learning & development team at a seafood restaurant franchise (South Africa & Cyprus) who train frontline restaurant crew via WhatsApp and Articulate courses.\n\n" +
    "Search the web for the most interesting content from roughly the last two weeks across these topics:\n- " + TOPICS.join("\n- ") + "\n\n" +
    "Pick 8-12 items. Mix formats: articles, YouTube videos, podcast episodes. Prefer practical over academic, and at least two items specifically useful for frontline/deskless training. Skip paywalled-only and press releases.\n\n" +
    "Return ONLY a JSON object, no other text, in exactly this shape:\n" +
    '{"summary":"3-4 sentences on what mattered in this world this week, written for this team in a warm internal tone",' +
    '"picks":[{"title":"...","url":"...","source":"publication/channel/show name","type":"article|video|podcast","topic":"short topic tag","blurb":"one punchy sentence on why it is worth their time"}]}';

  try {
    let text = "";
    if (oaKey) {
      // OpenAI Responses API with its built-in web search tool
      let r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${oaKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          tools: [{ type: "web_search" }],
          input: prompt
        })
      });
      let j = await r.json();
      if (!r.ok && j.error && /web_search/.test(j.error.message || "")) {
        // older accounts use the preview tool name
        r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${oaKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o",
            tools: [{ type: "web_search_preview" }],
            input: prompt
          })
        });
        j = await r.json();
      }
      if (!r.ok) { res.status(502).json({ error: (j.error && j.error.message) || "OpenAI error" }); return; }
      text = j.output_text || (j.output || [])
        .filter(o => o.type === "message")
        .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text))
        .join("");
      return finish(res, text);
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-5",
        max_tokens: 4000,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages: [{ role: "user", content: prompt }]
      })
    });
    const j = await r.json();
    if (!r.ok) { res.status(502).json({ error: (j.error && j.error.message) || "AI error" }); return; }

    const anthText = (j.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    return finish(res, anthText);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function finish(res, text) {
  const m = (text || "").match(/\{[\s\S]*\}/);
  if (!m) { res.status(200).json({ summary: (text || "").trim(), picks: [] }); return; }
  let data;
  try { data = JSON.parse(m[0]); }
  catch { res.status(200).json({ summary: (text || "").trim(), picks: [] }); return; }
  res.status(200).json({
    summary: String(data.summary || ""),
    picks: Array.isArray(data.picks) ? data.picks.filter(p => p && p.title && p.url) : [],
    fetched: new Date().toISOString()
  });
}
