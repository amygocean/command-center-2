import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const codeDirs=["js","api"];
const files=codeDirs.flatMap(dir=>fs.readdirSync(path.join(root,dir))
  .filter(name=>name.endsWith(".js"))
  .map(name=>path.join(root,dir,name)));
files.push(path.join(root,"serve.cjs"));

for(const file of files){
  const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.equal(result.status,0,`${path.relative(root,file)} failed syntax check:\n${result.stderr}`);
}

const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
assert.match(html,/data-tab="pr">PR<\/button>/,"PR tab must remain visible");
assert.doesNotMatch(html,/data-tab="pr"[^>]*display\s*:\s*none/,"PR tab is hidden");
assert.match(html,/https:\/\/app\.asana\.com\/1\/14491666778313\/project\/1216476690596926\/list\/1216477106031170/,"Communities link changed");
assert.doesNotMatch(html,/Create the Community Messages board/i,"Old Communities board creator returned");

const versions=[...html.matchAll(/\?v=([0-9a-z]+)/g)].map(match=>match[1]);
assert.ok(versions.length>0,"No asset cache-busters found");
assert.equal(new Set(versions).size,1,"Asset cache-busters are inconsistent");

const core=fs.readFileSync(path.join(root,"js/core.js"),"utf8");
assert.match(core,/save_dashboard_state/,"Shared dashboard-state sync is missing");
assert.match(core,/Saved on this browser; Asana sync will retry automatically/,"Automatic retry notice is missing");

console.log(`Verified ${files.length} code files and the shared UI safeguards.`);
