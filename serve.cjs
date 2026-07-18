// Tiny static server for local previews only (not used by Vercel).
// Run: node serve.js  → http://localhost:3999/?demo=1
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname;
const MIME = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml" };
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split("?")[0]);
  if(p==="/") p="/index.html";
  const f = path.join(ROOT, p);
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, {"Content-Type": MIME[path.extname(f)]||"application/octet-stream"});
  fs.createReadStream(f).pipe(res);
}).listen(3999, ()=>console.log("static on http://localhost:3999"));
