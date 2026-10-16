// B1 shell verification: login-only home, left menu + main window wiring,
// view/role gating, dirty-leave prompt. Static (no runtime); live miniflare
// smoke covers serving separately.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checks = [];
const check = (name, cond) => {
	assert.ok(cond, name);
	checks.push(name);
};
const html = readFileSync("server/public/index.html", "utf-8");
const client = readFileSync("server/public/client.txt", "utf-8");
const css = readFileSync("server/public/style.css", "utf-8");
const htmlIds = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
// Login home: login form + hidden session/menu; no business content outside.
check("login-form", html.includes('<form id="login">'));
check("menu-nav", html.includes('<nav id="menu"'));
check("shell-layout", html.includes('id="shell"') && html.includes('id="main"'));
check("session-hidden", html.includes('<section id="session" hidden>'));
// Every menu view maps to a real section id.
for (const id of ["draft-editor", "stage-editor", "stage-assets-editor", "library-editor", "copy", "admin"]) {
	check(`view-section:${id}`, htmlIds.has(id) && client.includes(`'${id}'`));
}
// Role gate: admin view withheld from non-admin/must-change; menu hidden anon.
check("role-gate", client.includes("mustChangePassword)) continue") && client.includes("q('menu').hidden = !current"));
check("session-gate", client.includes("q('session').hidden = !current"));
// §4.7 dirty-leave prompt.
check("beforeunload", client.includes("beforeunload") && client.includes("canLeave()"));
// Every q('id') lookup in client resolves to an id present in some served page.
const lookups = [...client.matchAll(/q\('([^']+)'\)/g)].map((m) => m[1]);
const extraPages = ["server/public/draft.txt", "server/public/stage.txt", "server/public/library.txt", "server/public/catalog.txt", "server/public/management.txt", "server/public/stageassets.txt"].map((f) => readFileSync(f, "utf-8")).join("\n");
for (const id of new Set(lookups)) {
	check(`lookup:${id}`, htmlIds.has(id) || extraPages.includes(`id="${id}"`));
}
// Menu CSS present.
check("menu-css", css.includes("#menu") && css.includes("#shell") && css.includes("#main"));
// B2 (§4.6): profile route + last-admin guard + dto fields.
check("profile-route", readFileSync("server/worker.js", "utf-8").includes("/api/auth/profile"));
check("admin-last", readFileSync("server/worker.js", "utf-8").includes("ADMIN_LAST"));
check("profile-form", htmlIds.has("profile") && client.includes("q('profile')"));
// B3 (§4.1): creator listing API + deletion routes + list UI columns/actions.
check("set-listed", readFileSync("server/metadata.js", "utf-8").includes("setListed(tokenHash, gameId, listed, expectedRowRevision)"));
check("listing-restricted", readFileSync("server/metadata.js", "utf-8").includes("LISTING_RESTRICTED"));
check("deletion-routes", readFileSync("server/worker.js", "utf-8").includes("/deletion(-operations") && readFileSync("server/worker.js", "utf-8").includes("deletionFence.begin") && readFileSync("server/worker.js", "utf-8").includes("deletionFence.query"));
check("own-games-columns", client.includes("createdAt") && client.includes("modifiedAt") && client.includes("管理限制，須管理員解除"));
check("trial-jump", client.includes("gotoGame") && readFileSync("server/public/draft.txt", "utf-8").includes("async function gotoGame"));
check("delete-confirm", client.includes("confirmationName") && client.includes("已上架遊戲須先下架再刪除"));
check("management-dates", readFileSync("server/public/management.txt", "utf-8").includes("g.createdAt"));
// B4b (§4.2): city reference helpers + stronghold section wiring.
check("city-refs", readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function cityReferences") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function checkCityDeletable") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("CITY_COUNT_LOCKED"));
check("stronghold-section", htmlIds.has("stronghold-editor") && htmlIds.has("stronghold-cities") && client.includes("installStronghold") && readFileSync("server/worker.js", "utf-8").includes("/stronghold.js"));
// B4c1 (§4.3): general field/portrait ops + generals section wiring.
check("general-ops", readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function renameGeneral") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function checkGeneralDeletable") && readFileSync("server/drafts.js", "utf-8").includes("'rename-general'") && readFileSync("server/drafts.js", "utf-8").includes("'portrait'"));
check("generals-section", htmlIds.has("generals-editor") && htmlIds.has("generals-chapters") && client.includes("installGenerals") && readFileSync("server/worker.js", "utf-8").includes("/general.js"));
// B4c2 (§4.3): faction post ops + faction panel.
check("faction-ops", readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function setMonarch") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function setStrategist") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function removeMonarch") && readFileSync("web/src/content/authoring/gamesource.js", "utf-8").includes("export function disbandFaction") && readFileSync("server/drafts.js", "utf-8").includes("'set-monarch'") && readFileSync("server/drafts.js", "utf-8").includes("'disband-faction'"));
check("faction-panel", readFileSync("server/public/general.txt", "utf-8").includes("factionPanel") && readFileSync("server/public/general.txt", "utf-8").includes("解散勢力"));
// B4d1 (§4.4): read-only schematic map viewer wiring.
check("mapview-section", htmlIds.has("mapview-editor") && htmlIds.has("mapview-canvas") && client.includes("installMapViewer") && readFileSync("server/worker.js", "utf-8").includes("/mapview.js"));
// BOOT-1: draft read receipt carries rosters + map for the list UIs.
check("receipt-rosters", readFileSync("server/drafts.js", "utf-8").includes("generals: st.generals.map") && readFileSync("server/drafts.js", "utf-8").includes("strongholds:") && readFileSync("server/drafts.js", "utf-8").includes("map: { placements:"));
// BOOT-1 fixes: chapter-edit allowlist (profile revert + chain history),
// per-chapter pack rows, listing gate order, If-Match regex.
check("profile-allowlist", readFileSync("server/copyprofile.js", "utf-8").includes("revertAppliedChapterEdits") && readFileSync("server/drafts.js", "utf-8").includes("#editHistory") && readFileSync("server/drafts.js", "utf-8").includes("value.chapterEdits"));
check("pack-chapters", readFileSync("server/playpacks.js", "utf-8").includes("published_pack_chapters") && readFileSync("server/deletionfence.js", "utf-8").includes("published_pack_chapters"));
check("listing-gate", (() => { const w = readFileSync("server/worker.js", "utf-8"); const mgmt = w.slice(w.indexOf("async #postManagement")); return mgmt.indexOf("MANAGEMENT_ACTION") < mgmt.indexOf("fields(value, ['action', 'expectedRowRevision'])"); })());
check("unlist-regex", (() => { const w = readFileSync("server/worker.js", "utf-8"); const admin = w.slice(w.indexOf("async #postAdminUnlist")); return admin.includes('/^"([1-9][0-9]*)"$/') && !admin.includes('$"/'); })());
check("profile-status", htmlIds.has("profile-status"));
// B決策：共用画像庫（manifest 唯讀，無上傳／刪除／逐遊戲表）。
check("portrait-routes", (() => { const w = readFileSync("server/worker.js", "utf-8"); return w.includes("portraits(?:\\/([A-Za-z0-9]{1,32}))?") && w.includes("#getPortraits") && !w.includes("#postPortraitUpload") && !w.includes("#postPortraitDelete"); })());
check("portrait-pack", (() => { const p = readFileSync("server/playpacks.js", "utf-8"); return p.includes("#freezePortraits") && p.includes("manifest.portraits") && p.includes("role: 'game-portrait'") && p.includes("kao/${row.assetId}.png"); })());
check("portrait-ui", htmlIds.has("portrait-pick") && htmlIds.has("portrait-library") && !htmlIds.has("portrait-file") && readFileSync("server/public/general.txt", "utf-8").includes("portrait-pick"));
// BOOT-1 truth: disband revert inserts by baseline relative order (not baseline
// index — history-compacted arrays misalign); copy-match is order-insensitive.
check("disband-order", (() => { const c = readFileSync("server/copyprofile.js", "utf-8"); const fn = c.slice(c.indexOf("const revertDisband")); return fn.includes("order.indexOf(factionIdx)") && !fn.includes("findIndex(f => f?.idx === factionIdx)"); })());
check("copy-order-free", (() => { const c = readFileSync("server/copyprofile.js", "utf-8"); const seg = c.slice(c.indexOf("// Order-insensitive")); return seg.includes("compare(baseRest, rest, new WeakMap())"); })());
// B4a (§4.5): chapter CRUD fns + save-pipeline ops + gaps receipt + no-chapter publish gate + UI.
const gamesource = readFileSync("web/src/content/authoring/gamesource.js", "utf-8");
const drafts = readFileSync("server/drafts.js", "utf-8");
const draft = readFileSync("server/public/draft.txt", "utf-8");
check("chapter-fns", gamesource.includes("export function addBlankChapter") && gamesource.includes("export function copyChapterInGame") && gamesource.includes("export function deleteChapter") && gamesource.includes("export function renameChapter") && gamesource.includes("export function chapterGapCounts"));
check("chapter-edits-pipe", drafts.includes("DRAFT_CHAPTER_EDITS") && drafts.includes("DRAFT_CHAPTER_EDIT") && drafts.includes("chapterGapCounts"));
check("no-chapter-gate", readFileSync("server/worker.js", "utf-8").includes("!captured.game.chapterOrder.length"));
check("chapter-ui", htmlIds.has("draft-chapters") && draft.includes("submitChapters") && draft.includes("renderChapters") && draft.includes("chapterAction"));
process.stdout.write(`editor shell matrix PASS ${checks.length} checks\n`);
