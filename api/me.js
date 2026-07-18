// Returns the logged-in user (or 401). The frontend calls this on load
// to decide whether to show the login screen or the dashboard.
import { readSession } from "./_lib.js";
export default function handler(req, res){
  const s = readSession(req);
  if(!s){ res.status(401).json({ authenticated:false }); return; }
  res.status(200).json({ authenticated:true, user: s.user });
}
