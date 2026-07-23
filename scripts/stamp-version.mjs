// Rewrites the ?v=… cache-busting token on every asset in index.html to a
// build-unique value, so a deploy can never serve a stale core.js/styles.css
// against a changed API. Runs automatically on Vercel via the "vercel-build"
// npm script; safe to run locally too.
//
// The version is the git commit SHA when Vercel provides it, otherwise a
// timestamp — either way it changes on every deploy.
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
