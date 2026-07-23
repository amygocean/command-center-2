// Optional helper: rewrites the ?v=… cache-busting token on every asset in
// index.html so a deploy can't serve a stale core.js/styles.css. Run manually
// with `npm run stamp` before committing a release if you'd rather not bump the
// version by hand. It is deliberately NOT wired into the Vercel build, so the
// site keeps deploying as a plain static project with no build step.
//
// The version is the git commit SHA when available, otherwise a timestamp.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "index.html");

const version = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 8) || String(Date.now());

const html = readFileSync(file, "utf8");
const stamped = html.replace(/\?v=[0-9A-Za-z._-]+/g, `?v=${version}`);

if (stamped !== html) {
  writeFileSync(file, stamped);
  console.log(`stamp-version: set asset version to ${version}`);
} else {
  console.log(`stamp-version: no asset tokens found to update (version ${version})`);
}
