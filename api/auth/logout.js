// Clear the session cookie and return to the app (which will show login).
import { clearSessionCookie } from "../_lib.js";
export default function handler(req, res){
  clearSessionCookie(res);
  res.writeHead(302, { Location: "/" });
  res.end();
}
