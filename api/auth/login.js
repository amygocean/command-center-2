// Start Asana OAuth: send the user to Asana to sign in and approve.
export default function handler(req, res){
  const state = Math.random().toString(36).slice(2);
  res.setHeader("Set-Cookie", `ob_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  const params = new URLSearchParams({
    client_id: process.env.ASANA_CLIENT_ID,
    redirect_uri: process.env.APP_URL + "/api/auth/callback",
    response_type: "code",
    state
  });
  res.writeHead(302, { Location: "https://app.asana.com/-/oauth_authorize?" + params.toString() });
  res.end();
}
