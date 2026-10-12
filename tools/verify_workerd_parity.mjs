// Task-5 workerd parity matrix (static, no workerd runtime needed):
// asserts every node play/publish behavior has its workerd counterpart wired
// in server sources. Live workerd proof: miniflare smoke (scratch, journaled).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checks = [];
const check = (name, cond) => {
	assert.ok(cond, name);
	checks.push(name);
};
const worker = readFileSync("server/worker.js", "utf-8");
const security = readFileSync("server/security.js", "utf-8");
const published = readFileSync("server/published.js", "utf-8");
const playpacks = readFileSync("server/playpacks.js", "utf-8");
const entry = worker; // entry + DO live in worker.js

// Routes exist on both planes (authed publish/unpublish, anonymous play surface).
for (const route of ["/api/publish", "/api/unpublish", "/api/published-games", "/api/trial-pack", "/api/trial-asset", "/api/play/web/", "/content/builtin/compiled/", "'/play'"]) {
	check(`route:${route}`, worker.includes(route));
}
// Entry serves the shell without a DO hop; bundle path matches fence rules.
check("entry-shell-no-do", entry.includes("playAppPage") && entry.includes("playappShell"));
check("entry-bundle-path", readFileSync("server/public/playapp.txt", "utf-8").includes("/api/play/web/src/editor/playapp.js"));
// Dual-domain gating: policy + welcome check + per-path classification.
check("play-origin-policy", security.includes("EDITOR_PLAY_ORIGIN") && security.includes("playOrigin"));
check("play-classify", worker.includes("playOriginOf(env)"));
check("play-welcome", worker.includes("welcome("));
// Registry fail-closed 500 on corrupt rows (never skip).
check("registry-corrupt", published.includes("PUBLISH_CORRUPT") && published.includes("500"));
check("pack-corrupt", playpacks.includes("PLAY_CORRUPT") && playpacks.includes("PLAY_PACK_CORRUPT"));
// Observable validation order: empty name 422 before ownership 404 (node parity).
{
	const pin = worker.slice(worker.indexOf("async #publishPin"));
	const nameAt = pin.indexOf("PUBLISH_NAME"), ownAt = pin.indexOf("GAME_NOT_FOUND");
	check("order:name-before-ownership", nameAt > 0 && ownAt > nameAt);
}
// Snapshot pinning: revision+digest mismatch 409, frozen pack store.
check("snapshot-409", playpacks.includes("PLAY_SNAPSHOT_CHANGED"));
check("frozen-store", playpacks.includes("Object.freeze") && playpacks.includes("published_pack_assets"));
// Unpublish idempotent no-op on missing rows (node parity).
check("unpublish-idempotent", worker.includes("retire(") && published.includes("unpublished"));
// No new worker bindings (routes only, wrangler.jsonc unchanged surface).
const wrangler = readFileSync("server/wrangler.jsonc", "utf-8");
check("no-new-bindings", !wrangler.includes("EDITOR_PLAY") && (wrangler.match(/"binding"/g) ?? []).length === 1);
process.stdout.write(`workerd parity matrix PASS ${checks.length} checks\n`);
