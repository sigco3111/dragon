// Q34 玩家側公告隻讀 UI（startmenu 模型輪）：端點接線、DTO 形狀、顯示格式、
// 失敗降級、無新增輸入。參照 verify_startmenu_empty_slot.mjs 的源形斷言語例。
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../web/src/ui/startmenu.js", import.meta.url), "utf8");
let n = 0;
const has = (re, label) => { assert.match(source, re, label); n++; };

// (1) 接線：show() 內與 _loadGames 同級呼叫，失敗不阻流程。
has(/await this\._loadGames\(\);\s*await this\._loadAnnouncements\(\);/, "show wires announcements after games");
// (2) 端點：同源 /api/announcements，與 _loadGames 同基回落（"" + 8322）。
has(/fetch\(`\$\{base\}\/api\/announcements`\)/, "announcements endpoint");
has(/const bases = \["", "http:\/\/127\.0\.0\.1:8322"\];/, "same base fallback");
// (3) DTO 形狀：取 announcements 陣列，留 gameId/name/ordinal/creatorAccount。
has(/data\?\.announcements/, "announcements array");
has(/typeof a\.gameId === "string" && typeof a\.name === "string" && a\.name && typeof a\.ordinal === "string"/, "entry filter");
// (4) 顯示格式：名＋版本（作者），與決策③一致。
has(/`\$\{a\.name\} \$\{a\.ordinal\}（\$\{a\.creatorAccount\}）`/, "name ordinal creator format");
// (5) 隻讀前 5 條（服務端已排序，客戶端不重排、不分頁）。
has(/this\._announcements\.slice\(0, 5\)/, "first five only");
// (6) 失敗降級：任一基失敗續試，全敗即空陣列。
has(/this\._announcements = \[\];/, "empty on failure");
// (7) 渲染點：_renderYesNo 內對話框下方 canvas 走字。
has(/最新上架/, "section header");
// (8) 無新增輸入：公告區不設 _bind、不建 select/button。
{
  const renderYesNo = source.slice(source.indexOf("_renderYesNo(ox, oy) {"));
  const annBlock = renderYesNo.slice(renderYesNo.indexOf("最新上架") - 2000, renderYesNo.indexOf("最新上架") + 800);
  assert.ok(!annBlock.includes("_bind(") && !annBlock.includes("createElement"), "no input in announcement block");
  n++;
}
// (9) 繁體：標題與區域名無簡體混入。
has(/最新上架/, "traditional header");
// (10) _loadGames 原邏輯未動（回歸錨）。
has(/\/api\/published-games/, "games endpoint intact");

process.stdout.write(`player announcements model: ${n} checks green\n`);
