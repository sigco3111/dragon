// 모바일(터치) 보조 조작 오버레이.
// 전략 맵에서 우클릭(contextmenu)이 담당하는 계층 뒤로가기는 터치 화면에서
// 재현할 수 없다. coarse pointer(터치) 환경에서만 보이는 "뒤로" 버튼을 띄워
// 기존 gamebar 우클릭 경로(btn===2)로 그대로 전달한다.
// DOM 오버레이라 시나리오 데이터·게임 규칙·세이브에는 영향이 없다.
// 검증용으로 ?mobileui=1 을 붙이면 마우스 환경에서도 강제 표시된다.

export function attachMobileControls(app, env = {}) {
  const matchMedia = env.matchMedia ?? globalThis.matchMedia?.bind(globalThis);
  const search = env.search ?? globalThis.location?.search ?? "";
  const doc = env.document ?? globalThis.document;
  const forced = new URLSearchParams(search).get("mobileui") === "1";
  const coarse = matchMedia?.("(pointer: coarse)")?.matches ?? false;
  if (!forced && !coarse) return null;
  if (!doc) return null;

  const root = doc.createElement("div");
  root.id = "mobilecontrols";
  root.style.cssText =
    "position:fixed;left:8px;top:50%;transform:translateY(-50%);" +
    "z-index:9999;display:flex;flex-direction:column;gap:8px;";

  const back = doc.createElement("button");
  back.type = "button";
  back.id = "mobilecontrols-back";
  back.textContent = "뒤로";
  // 게임 표면(논리 640px 폭)이 390px 실기기에서 ~0.61배로 축소 표시되므로,
  // 실측치 기준 터치 목표를 확보하려면 CSS 크기를 크게 잡는다 (76px -> 실기기 ~46px).
  back.style.cssText =
    "min-width:84px;min-height:80px;padding:10px 14px;font-size:22px;" +
    "background:rgba(20,16,8,0.85);color:#f0d8a0;border:1px solid #a08040;" +
    "border-radius:4px;touch-action:manipulation;";
  back.addEventListener("click", () => {
    if (!app.gameStarted || !app.scenario) return;
    // 우클릭과 동일한 계층 뒤로가기. 좌표는 btn===2 분기에서 사용되지 않는다.
    app.gamebar?.click(0, 0, 2, null);
    app.view?.draw();
  });

  // 전투 중 우측 정보 창(적 정보/작전 헤더)을 접는 토글.
  // 640px 논리 폭이 기기에 축소 표시될 때 우측 창들이 전장을 가리는 문제를
  // 사용자가 직접 해소할 수 있게 한다 (DOM 오버레이 토글, 규칙 무영향).
  // 명령 창(.battle-player-window)과 대화창은 유지한다.
  const info = doc.createElement("button");
  info.type = "button";
  info.id = "mobilecontrols-info";
  info.textContent = "정보";
  info.style.cssText =
    "min-width:84px;min-height:80px;padding:10px 14px;font-size:22px;" +
    "background:rgba(20,16,8,0.85);color:#f0d8a0;border:1px solid #a08040;" +
    "border-radius:4px;touch-action:manipulation;";
  info.addEventListener("click", () => {
    doc.body.classList.toggle("mobile-battle-info-collapsed");
  });

  // 전략 화면 8개 메뉴(건언~세력)의 DOM 대체 바.
  // 캔버스 비트맵 메뉴는 640px 설계가 기기에 축소 표시되며 실효 ~10px로
  // 읽기 어렵다. 같은 gamebar.click 경로를 부르는 실버튼으로 바꿔
  // 판독성과 터치 목표를 확보한다 (규칙·상태 변경 없음, 표시 전용).
  // 하단 안내창을 가리지 않도록 기본은 접힌 상태이고 "메뉴"로 펼친다.
  const MENU_LABELS = [
    "건언",
    "인사",
    "재정",
    "편성",
    "군단",
    "거점",
    "무장",
    "세력",
  ];
  const menuBar = doc.createElement("div");
  menuBar.id = "mobilecontrols-menubar";
  menuBar.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:9999;display:none;" +
    "gap:6px;max-width:calc(100vw - 16px);overflow-x:auto;" +
    "background:rgba(20,16,8,0.9);border:1px solid #a08040;" +
    "border-radius:6px;padding:6px;";
  const menuButtons = MENU_LABELS.map((label, i) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "min-width:84px;min-height:72px;padding:10px 12px;font-size:24px;" +
      "background:rgba(40,32,16,0.95);color:#f0d8a0;" +
      "border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
    b.addEventListener("click", () => {
      if (!app.gameStarted || !app.scenario) return;
      const g = app.gamebar;
      if (!g) return;
      // 원본 캔버스 경로와 동일: 부채 아이콘(군사 메뉴 띠 개폐) → 띠 셀 선택.
      // 다른 항목이 이미 선택된 상태에서의 전환은 원본과 같이 무시된다
      // (뒤로 버튼으로 한 단계 닫은 뒤 다시 선택).
      if (!g.submenuOpen) g.click((g.bx || 0) + 351, 15, 0);
      if (g.selectedSubmenu == null) g.click((g.bx || 0) + 47 + 78 * i, 56, 0);
      refreshMenuHighlight();
    });
    menuBar.appendChild(b);
    return b;
  });
  function refreshMenuHighlight() {
    const sel = app.gamebar?.selectedSubmenu ?? null;
    menuButtons.forEach((b, j) => {
      b.style.outline = sel === j ? "3px solid #ffe9a8" : "none";
    });
  }
  const menu = doc.createElement("button");
  menu.type = "button";
  menu.id = "mobilecontrols-menu";
  menu.textContent = "메뉴";
  menu.style.cssText =
    "min-width:84px;min-height:80px;padding:10px 14px;font-size:22px;" +
    "background:rgba(20,16,8,0.85);color:#f0d8a0;border:1px solid #a08040;" +
    "border-radius:4px;touch-action:manipulation;";
  menu.addEventListener("click", () => {
    const open = menuBar.style.display !== "flex";
    menuBar.style.display = open ? "flex" : "none";
    if (open) refreshMenuHighlight();
  });


  // 목록 팝업(거점/무장/세력 등 canvas listDialog)의 DOM 미러.
  // 캔버스 목록은 640px 설계가 축소 표시되어 실효 글씨가 ~8px라 읽기 어렵다.
  // 같은 listDialog 상태(rows/cols/onPick/정렬)를 읽어 큰 글씨와 큰 터치 행으로
  // 표시한다. 표시 전용: 선택은 기존 onPickCell/onPick 콜백을 그대로 호출한다.
  const listBox = doc.createElement("div");
  listBox.id = "mobilecontrols-list";
  listBox.style.cssText =
    "position:fixed;left:0;right:0;top:0;bottom:0;z-index:9998;display:none;" +
    "flex-direction:column;background:#efe3c0;color:#000;" +
    "border-bottom:3px solid #a08040;font-family:inherit;";
  const listBar = doc.createElement("div");
  listBar.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;" +
    "background:#201808;color:#f0d8a0;padding:6px 10px;font-size:26px;";
  const listTitle = doc.createElement("span");
  const listClose = doc.createElement("button");
  listClose.type = "button";
  listClose.id = "mobilecontrols-list-close";
  listClose.textContent = "닫기";
  listClose.style.cssText =
    "min-width:96px;min-height:64px;font-size:26px;background:#402c10;" +
    "color:#f0d8a0;border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
  listClose.addEventListener("click", () => {
    app.gamebar?.closeListDialog();
  });
  listBar.appendChild(listTitle);
  listBar.appendChild(listClose);
  const listHead = doc.createElement("div");
  listHead.style.cssText =
    "display:flex;background:#000;color:#fff;font-size:24px;";
  const listBody = doc.createElement("div");
  listBody.style.cssText =
    "overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1 1 0;min-height:0;padding-bottom:110px;" +
    "touch-action:pan-y;";
  listBox.append(listBar, listHead, listBody);
  doc.body.appendChild(listBox);

  let listSig = "";
  function cellText(c) {
    const v = typeof c === "object" && c !== null ? c.t : c;
    return String(v ?? "");
  }
  function syncList() {
    const g = app.gamebar;
    const d = g?.listDialog;
    // 무장 카드/편성 창 등 다른 캔버스 창이 위에 있으면 가리지 않도록 숨김.
    if (!d || g.generalCard || g.formationDialog || !app.gameStarted) {
      if (listBox.style.display !== "none") listBox.style.display = "none";
      root.style.display = "flex";
      listSig = "";
      return;
    }
    const sig = [
      d.title,
      d.rows.length,
      d.sortColumn,
      d.sortDirection,
      d.selectedRow,
      d.rows[0] && cellText(d.rows[0].cells?.[0]),
      d.rows.map((r) => cellText(r.cells?.[1])).join("|").length,
    ].join("/");
    if (sig === listSig && listBox.style.display === "flex") return;
    listSig = sig;
    listBox.style.display = "flex";
    root.style.display = "none"; // 닫기 버튼이 뒤로 역할, 좌측 버튼이 첫 열을 가리지 않게
    const subIdx = g.selectedSubmenu;
    listTitle.textContent = d.title || (subIdx != null ? MENU_LABELS[subIdx] : "") || "목록";
    const cols = d.cols ?? [];
    const total = cols.reduce((a, c) => a + (c.w || 1), 0) || 1;
    const flexOf = (c) => `flex:${(c.w || 1) / total} 1 0;min-width:0;`;
    listHead.textContent = "";
    (d.header ?? []).forEach((h, i) => {
      const col = cols[i];
      if (!col) return;
      const el = doc.createElement("div");
      el.textContent = h + (d.sortColumn === i ? (d.sortDirection > 0 ? " ▲" : " ▼") : "");
      el.style.cssText =
        flexOf(col) +
        `padding:10px 4px;text-align:${col.align || "left"};touch-action:manipulation;`;
      el.addEventListener("click", () => {
        if (g._sortListDialog(i)) app.view?.draw();
      });
      listHead.appendChild(el);
    });
    const prevTop = listBody.scrollTop;
    listBody.textContent = "";
    d.rows.forEach((row, ri) => {
      const rowEl = doc.createElement("div");
      const sel = ri === d.selectedRow;
      rowEl.style.cssText =
        "display:flex;align-items:center;min-height:60px;font-size:24px;" +
        "border-bottom:1px solid rgba(0,0,0,0.25);touch-action:manipulation;" +
        (sel ? "background:#4a7828;" : "");
      (row.cells ?? []).forEach((cell, ci) => {
        const col = cols[ci];
        if (!col) return;
        const el = doc.createElement("div");
        el.textContent = cellText(cell);
        const color = sel
          ? "#e8ff60"
          : (typeof cell === "object" && cell?.color) || "#000";
        el.style.cssText =
          flexOf(col) +
          `padding:4px;text-align:${col.align || "left"};color:${color};` +
          "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        rowEl.appendChild(el);
      });
      rowEl.addEventListener("click", (ev) => {
        let ci = 0;
        const cellEls = Array.from(rowEl.children);
        const hit = cellEls.findIndex((e) => e === ev.target || e.contains(ev.target));
        if (hit >= 0) ci = hit;
        if (d.onPickCell) {
          d.onPickCell(ri, ci);
        } else if (d.onPick) {
          d.selectedRow = ri;
          d.onPick(ri);
        }
        app.view?.draw();
      });
      listBody.appendChild(rowEl);
    });
    listBody.scrollTop = prevTop;
  }
  const listTimer = globalThis.setInterval?.(syncList, 250);
  root.dataset.listSync = listTimer ? "1" : "0";

  root.appendChild(back);
  root.appendChild(info);
  root.appendChild(menu);
  doc.body.appendChild(root);
  doc.body.appendChild(menuBar);
  return root;
}
