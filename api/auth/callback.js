// Asana redirects back here with ?code=... — exchange it for tokens,
// store them in the signed session cookie, then send the user to the app.
import { setSessionCookie } from "../_lib.js";

export default async function handler(req, res){
  const url = new URL(req.url, process.env.APP_URL);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (req.headers.cookie||"").split(";").map(s=>s.trim()).find(s=>s.startsWith("ob_oauth_state="));
  if(!code || !cookieState || cookieState.split("=")[1] !== state){
    res.status(400).send("Login failed (state mismatch). Please try again."); return;
  }
  try {
    const r = await fetch("https://app.asana.com/-/oauth_token", {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:"authorization_code",
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        redirect_uri: process.env.APP_URL + "/api/auth/callback",
        code
      })
    });
    const j = await r.json();
    if(!r.ok) throw new Error(j.error_description || "token exchange failed");
    setSessionCookie(res, {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in-60)*1000,
      user: j.data ? { gid: String(j.data.gid||j.data.id), name: j.data.name } : null
    });
    res.writeHead(302, { Location: "/" });
    res.end();
  } catch(e){ res.status(500).send("Login error: "+e.message); }
}
