// ------------------------------------------------------------------
//  Shared helpers for the serverless API:
//   - cookie read/write (holds the signed Asana session)
//   - Asana OAuth token refresh
//   - asanaFetch(): call Asana REST as the logged-in user
//
//  The user's Asana tokens live in an httpOnly, signed cookie so they
//  are never visible to browser JavaScript. Secrets (client secret,
//  Anthropic key) only ever exist here on the server.
// ------------------------------------------------------------------
import crypto from "crypto";

const COOKIE = "ob_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// --- tiny signed-cookie implementation (no external deps) ---
function sign(v){ return crypto.createHmac("sha256", SECRET).update(v).digest("base64url"); }
export function packSession(obj){
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return body + "." + sign(body);
}
export function readSession(req){
  const raw = (req.headers.cookie || "").split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="));
  if(!raw) return null;
  const val = decodeURIComponent(raw.slice(COOKIE.length+1));
  const [body, mac] = val.split(".");
  if(!body || !mac || sign(body)!==mac) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
}
export function setSessionCookie(res, session){
  const val = encodeURIComponent(packSession(session));
  res.setHeader("Set-Cookie", `${COOKIE}=${val}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
}
export function clearSessionCookie(res){
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

// --- refresh an expired Asana access token using the refresh token ---
async function refresh(session){
  const r = await fetch("https://app.asana.com/-/oauth_token", {
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:"refresh_token",
      client_id: process.env.ASANA_CLIENT_ID,
      client_secret: process.env.ASANA_CLIENT_SECRET,
      refresh_token: session.refresh_token
    })
  });
  if(!r.ok) throw new Error("asana refresh failed");
  const j = await r.json();
  session.access_token = j.access_token;
  session.expires_at = Date.now() + (j.expires_in-60)*1000;
  return session;
}

// Return a valid OAuth access token for endpoints that cannot use the normal
// JSON-only asanaFetch helper (for example multipart attachment uploads).
// Keeping refresh handling here means callers do not need to duplicate the
// session-expiry logic or accidentally use an expired browser session.
export async function getAsanaAccessToken(req, res){
  let session = readSession(req);
  if(!session) { const e = new Error("not authenticated"); e.status = 401; throw e; }
  if(!session.expires_at || Date.now() > session.expires_at){
    session = await refresh(session);
    setSessionCookie(res, session);
  }
  return session.access_token;
}

// --- call Asana REST as the user; auto-refreshes and re-saves the cookie ---
export async function asanaFetch(req, res, path, opts={}){
  const accessToken = await getAsanaAccessToken(req, res);
  const r = await fetch("https://app.asana.com/api/1.0"+path, {
    method: opts.method || "GET",
    headers: { "Authorization":"Bearer "+accessToken, "Content-Type":"application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw:text }; }
  if(!r.ok){ const e = new Error((json.errors&&json.errors[0]&&json.errors[0].message)||("Asana "+r.status)); e.status=r.status; throw e; }
  return json;
}

export const WORKSPACE = process.env.ASANA_WORKSPACE || "14491666778313";
