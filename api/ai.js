// ------------------------------------------------------------------
//  /api/ai  —  replaces the old window.cowork.askClaude() bridge.
//  Takes { prompt, data } and returns { text }.
//  Uses OpenAI if OPENAI_API_KEY is set, otherwise Anthropic if
//  ANTHROPIC_API_KEY is set. The key stays server-side (never in the
//  browser). If neither is set, AI features simply report "off".
// ------------------------------------------------------------------
import { readSession } from "./_lib.js";

async function readBody(req){
  if(req.body && typeof req.body==="object") return req.body;
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString()||"{}"); } catch { return {}; }
}

// Guard the shared, paid AI key: cap how much text one request can forward and
// throttle each signed-in user so a huge paste or a runaway loop cannot burn
// the token budget. In-memory and best-effort — it resets on cold starts, but
// still blunts the common abuse and accident cases.
const MAX_CONTENT_CHARS = 60000;   // ~15k tokens; comfortably covers a chat export
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 20;               // requests per user per minute
const rateHits = new Map();
function rateLimited(key){
  const now = Date.now();
  const hits = (rateHits.get(key)||[]).filter(t=>now-t<RATE_WINDOW_MS);
  hits.push(now);
  rateHits.set(key, hits);
  return hits.length > RATE_MAX;
}

export default async function handler(req,res){
  if(req.method!=="POST"){ res.status(405).json({error:"POST only"}); return; }
  const session = readSession(req);
  if(!session){ res.status(401).json({error:"not authenticated"}); return; }

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if(!openaiKey && !anthropicKey){ res.status(200).json({ text:"(AI is turned off — set OPENAI_API_KEY or ANTHROPIC_API_KEY.)" }); return; }

  const rateKey = String((session.user&&session.user.gid)||"anon");
  if(rateLimited(rateKey)){ res.status(429).json({ error:"Too many AI requests — give it a minute and try again." }); return; }

  const { prompt, data } = await readBody(req);
  let content = String(prompt||"") + "\n\nDATA:\n" + JSON.stringify(data||[]);
  if(content.length > MAX_CONTENT_CHARS) content = content.slice(0, MAX_CONTENT_CHARS) + "\n…(truncated)";

  try {
    let text = "";
    if(openaiKey){
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers:{ "Authorization":"Bearer "+openaiKey, "content-type":"application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: 700,
          messages:[{ role:"user", content }]
        })
      });
      const j = await r.json();
      if(!r.ok){ res.status(502).json({ error:(j.error&&j.error.message)||"OpenAI error" }); return; }
      text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
    } else {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "x-api-key":anthropicKey, "anthropic-version":"2023-06-01", "content-type":"application/json" },
        body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-5", max_tokens:700, messages:[{ role:"user", content }] })
      });
      const j = await r.json();
      if(!r.ok){ res.status(502).json({ error:(j.error&&j.error.message)||"AI error" }); return; }
      text = (j.content||[]).map(b=>b.text||"").join("").trim();
    }
    res.status(200).json({ text });
  } catch(e){ res.status(500).json({ error:e.message }); }
}
