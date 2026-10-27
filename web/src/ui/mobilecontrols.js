// 모바일(터치) 보조 조작 오버레이.
// 전략 맵에서 우클릭(contextmenu)이 담당하는 계층 뒤로가기는 터치 화면에서
// 재현할 수 없다. coarse pointer(터치) 환경에서만 보이는 "뒤로" 버튼을 띄워
// 기존 gamebar 우클릭 경로(btn===2)로 그대로 전달한다.
// DOM 오버레이라 시나리오 데이터·게임 규칙·세이브에는 영향이 없다.
// 검증용으로 ?mobileui=1 을 붙이면 마우스 환경에서도 강제 표시된다.

const pendingPointerDocuments = new WeakSet();

export function attachMobileControls(app, env = {}) {
  const matchMedia = env.matchMedia ?? globalThis.matchMedia?.bind(globalThis);
  const search = env.search ?? globalThis.location?.search ?? "";
  const doc = env.document ?? globalThis.document;
  const forced = new URLSearchParams(search).get("mobileui") === "1";
  const pointerQuery = matchMedia?.("(pointer: coarse)");
  const coarse = pointerQuery?.matches ?? false;
  if (!doc) return null;
  const existing = doc.querySelector?.("#mobilecontrols");
  if (existing) return existing;
  // 화면/입력 환경이 로드 후 터치로 바뀌어도 보조 조작을 놓치지 않는다.
  // 같은 Document의 반복 초기화가 리스너나 DOM을 중복 생성하지 않게 한다.
  if (!forced && !coarse) {
    if (pointerQuery?.addEventListener && !pendingPointerDocuments.has(doc)) {
      pendingPointerDocuments.add(doc);
      const onPointerChange = (event) => {
        if (!event.matches) return;
        pointerQuery.removeEventListener("change", onPointerChange);
        pendingPointerDocuments.delete(doc);
        attachMobileControls(app, env);
      };
      pointerQuery.addEventListener("change", onPointerChange);
    }
    return null;
  }

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

  // 전투 중 큰 정보 패널 토글. 원본 정보 창(작전 헤더·적 정보·명령 창·
  // 하단 부대 카드)은 640px 설계가 기기에 축소 표시되어 실효 글씨가 매우
  // 작다. 토글 시 원본 창을 숨기고 같은 상태를 읽는 큰 미러 패널로
  // 대체한다 (DOM 오버레이, 규칙 무영향). 대화창은 유지한다.
  const info = doc.createElement("button");
  info.type = "button";
  info.id = "mobilecontrols-info";
  info.textContent = "정보";
  info.style.cssText =
    "min-width:84px;min-height:80px;padding:10px 14px;font-size:22px;" +
    "background:rgba(20,16,8,0.85);color:#f0d8a0;border:1px solid #a08040;" +
    "border-radius:4px;touch-action:manipulation;";
  info.addEventListener("click", () => {
    if (!app.battleView?.active) return;
    doc.body.classList.toggle("mobile-battle-biginfo");
    refreshInfoHighlight();
  });
  function refreshInfoHighlight() {
    const open = doc.body.classList.contains("mobile-battle-biginfo");
    info.style.outline = open ? "3px solid #ffe9a8" : "none";
  }

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

  // Browsers can clamp scrollTop during transient viewport-meta relayouts.
  // Retain intent per dialog, not the transient DOM value (and not a new list).
  const listScroll = new WeakMap();
  let activeList = null;
  let resizingList = false;
  let resizeTimer = null;
  const restoreListScroll = () => {
    if (activeList && listBox.style.display === "flex")
      listBody.scrollTop = listScroll.get(activeList) ?? 0;
  };
  listBody.addEventListener("scroll", () => {
    if (!resizingList && activeList && listBox.style.display === "flex")
      listScroll.set(activeList, listBody.scrollTop);
  }, { passive: true });
  const onListViewportChange = () => {
    resizingList = true;
    globalThis.clearTimeout?.(resizeTimer);
    resizeTimer = globalThis.setTimeout?.(() => {
      restoreListScroll();
      // The restore's scroll event must not overwrite a temporarily clamped intent.
      globalThis.setTimeout?.(() => { resizingList = false; }, 50);
    }, 350);
  };
  globalThis.addEventListener?.("resize", onListViewportChange);
  globalThis.addEventListener?.("orientationchange", onListViewportChange);

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
    activeList = d;
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
    const prevTop = listScroll.get(d) ?? 0;
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
        // 목록에서 카드로 넘어가면 하단 메뉴를 접어 카드 내용을 가리지 않는다.
        // 좌측 "메뉴" 버튼으로 언제든 다시 펼칠 수 있다.
        if (!g.listDialog || g.cityCard || g.generalCard) menuBar.style.display = "none";
        app.view?.draw();
      });
      listBody.appendChild(rowEl);
    });
    listBody.scrollTop = prevTop;
  }
  // A touch-sized mirror forwards to the existing tactical buttons, including
  // their disabled state. It never queues commands by itself or changes rules.
  const battleDock = doc.createElement("div");
  battleDock.id = "mobilecontrols-battle";
  battleDock.style.cssText =
    "position:fixed;left:8px;right:8px;bottom:76px;z-index:9997;display:none;" +
    "grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;" +
    "background:rgba(20,16,8,.94);border:1px solid #a08040;border-radius:6px;";
  const tacticalButtons = [
    ["bassault", "돌격"], ["battack", "공격"], ["bformation", "진형"],
    ["bwall", "성벽"], ["bdefend", "수진"], ["bretreat", "퇴각"],
  ].map(([id, label]) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.nativeButton = id;
    button.style.cssText =
      "min-height:76px;font-size:26px;background:#402c10;color:#f0d8a0;" +
      "border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
    button.addEventListener("click", () => {
      const native = doc.querySelector?.("#" + id);
      if (app.battleView?.active && native && !native.disabled) native.click();
    });
    battleDock.appendChild(button);
    return button;
  });
  doc.body.appendChild(battleDock);

  // 전투 정보 미러 패널 (표시 전용 + 원본 요소로 입력 전달).
  // 원본 창의 텍스트·아이콘·선택 상태를 250ms 간격으로 읽어 큰 글씨와
  // 큰 터치 목표로 보여준다. 부대 카드/진형/배치 입력은 원본 요소의
  // click()으로만 전달하므로 명령 경로와 규칙은 바뀌지 않는다.
  const infoPanel = doc.createElement("div");
  infoPanel.id = "mobilecontrols-battleinfo";
  infoPanel.style.cssText =
    "position:fixed;left:0;right:0;top:0;z-index:9996;display:none;" +
    "flex-direction:column;gap:6px;max-height:62vh;overflow-y:auto;" +
    "-webkit-overflow-scrolling:touch;background:rgba(20,16,8,0.96);" +
    "border-bottom:3px solid #a08040;padding:8px;color:#f0d8a0;" +
    "touch-action:pan-y;";
  const biHead = doc.createElement("div");
  biHead.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;";
  const biTitleBox = doc.createElement("div");
  const biTitle = doc.createElement("div");
  biTitle.style.cssText = "font-size:28px;font-weight:bold;";
  const biVs = doc.createElement("div");
  biVs.style.cssText = "font-size:22px;color:#d8c090;";
  biTitleBox.append(biTitle, biVs);
  const biClose = doc.createElement("button");
  biClose.type = "button";
  biClose.id = "mobilecontrols-battleinfo-close";
  biClose.textContent = "닫기";
  biClose.style.cssText =
    "min-width:96px;min-height:64px;font-size:26px;background:#402c10;" +
    "color:#f0d8a0;border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
  biClose.addEventListener("click", () => {
    doc.body.classList.remove("mobile-battle-biginfo");
    refreshInfoHighlight();
  });
  biHead.append(biTitleBox, biClose);
  const biSides = doc.createElement("div");
  biSides.style.cssText = "display:flex;gap:8px;";
  const mkSide = (labelColor) => {
    const box = doc.createElement("div");
    box.style.cssText =
      "flex:1 1 0;min-width:0;background:rgba(0,0,0,0.35);" +
      "border:1px solid #6b5335;border-radius:4px;padding:6px;";
    const name = doc.createElement("div");
    name.style.cssText = `font-size:24px;color:${labelColor};`;
    const numbers = doc.createElement("div");
    numbers.style.cssText = "display:flex;gap:12px;font-size:26px;";
    const troops = doc.createElement("span");
    const morale = doc.createElement("span");
    numbers.append(troops, morale);
    const troopsTrack = doc.createElement("div");
    troopsTrack.style.cssText =
      "height:10px;background:#3a1800;margin-top:4px;";
    const troopsFill = doc.createElement("div");
    troopsFill.style.cssText = "height:100%;width:0;background:#d00000;";
    troopsTrack.appendChild(troopsFill);
    const moraleTrack = doc.createElement("div");
    moraleTrack.style.cssText =
      "height:10px;background:#3a3400;margin-top:2px;";
    const moraleFill = doc.createElement("div");
    moraleFill.style.cssText = "height:100%;width:0;background:#f0e000;";
    moraleTrack.appendChild(moraleFill);
    box.append(name, numbers, troopsTrack, moraleTrack);
    biSides.appendChild(box);
    return { name, troops, morale, troopsFill, moraleFill };
  };
  const biPlayer = mkSide("#ff9b7e");
  const biEnemy = mkSide("#8fb8ff");
  const biUnits = doc.createElement("div");
  biUnits.style.cssText =
    "display:grid;grid-template-columns:repeat(2,1fr);gap:6px;";
  const unitCards = [];
  for (let i = 0; i < 6; i++) {
    const card = doc.createElement("button");
    card.type = "button";
    card.dataset.nativeCard = `#bunit${i}`;
    card.style.cssText =
      "display:flex;align-items:center;gap:8px;min-height:76px;" +
      "background:rgba(40,32,16,0.95);border:1px solid #a08040;" +
      "border-radius:4px;padding:6px;touch-action:manipulation;" +
      "color:#f0d8a0;text-align:left;";
    const role = doc.createElement("span");
    role.style.cssText =
      "min-width:64px;font-size:24px;font-weight:bold;color:#111;" +
      "background:linear-gradient(#f1d394,#c28a3a 55%,#8f5420);" +
      "border-radius:3px;padding:4px 6px;text-align:center;";
    const icon = doc.createElement("span");
    icon.style.cssText =
      "flex:0 0 56px;width:56px;height:38px;background-repeat:no-repeat;" +
      "background-position:center;background-size:100% 100%;" +
      "image-rendering:pixelated;";
    const status = doc.createElement("span");
    status.style.cssText =
      "flex:0 0 56px;width:56px;height:38px;background-repeat:no-repeat;" +
      "background-position:center;background-size:100% 100%;" +
      "image-rendering:pixelated;";
    const mid = doc.createElement("span");
    mid.style.cssText =
      "flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;";
    const troopsVal = doc.createElement("span");
    troopsVal.style.cssText = "font-size:28px;font-weight:bold;";
    const troopsTrack = doc.createElement("span");
    troopsTrack.style.cssText =
      "display:block;height:8px;background:#4c2400;";
    const troopsFill = doc.createElement("span");
    troopsFill.style.cssText =
      "display:block;height:100%;width:0;background:#ffd000;";
    troopsTrack.appendChild(troopsFill);
    mid.append(troopsVal, troopsTrack);
    card.append(role, icon, status, mid);
    card.addEventListener("click", () => {
      if (!app.battleView?.active) return;
      doc.querySelector?.(`#bunit${i}`)?.click?.();
    });
    biUnits.appendChild(card);
    unitCards.push({ card, role, icon, status, troopsVal, troopsFill });
  }
  const biFormationLabel = doc.createElement("div");
  biFormationLabel.textContent = "진형";
  biFormationLabel.style.cssText = "font-size:22px;color:#d8c090;";
  const biFormations = doc.createElement("div");
  biFormations.style.cssText =
    "display:grid;grid-template-columns:repeat(8,1fr);gap:4px;";
  const formationButtons = [];
  for (let n = 0; n < 16; n++) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.dataset.nativeFormation = String(n);
    btn.style.cssText =
      "min-height:56px;background-color:rgba(40,32,16,0.95);" +
      "background-repeat:no-repeat;background-position:center;" +
      "background-size:80% 80%;image-rendering:pixelated;" +
      "border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
    const bg = `url("grf/ui/battle_symbol_${n}.png")`;
    btn.style.backgroundImage = bg;
    btn.addEventListener("click", () => {
      if (!app.battleView?.active) return;
      doc.querySelector?.(`.battle-symbol-btn[data-formation="${n}"]`)
        ?.click?.();
    });
    biFormations.appendChild(btn);
    formationButtons.push(btn);
  }
  const biDeployLabel = doc.createElement("div");
  biDeployLabel.textContent = "배치 위치";
  biDeployLabel.style.cssText = "font-size:22px;color:#d8c090;";
  const biDeploys = doc.createElement("div");
  biDeploys.style.cssText = "display:flex;gap:6px;";
  const deployButtons = [];
  for (const baseX of [48, 28, 5]) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.dataset.nativeBaseX = String(baseX);
    btn.textContent = `X${baseX}`;
    btn.style.cssText =
      "flex:1 1 0;min-height:56px;font-size:24px;" +
      "background:rgba(40,32,16,0.95);color:#f0d8a0;" +
      "border:1px solid #a08040;border-radius:4px;touch-action:manipulation;";
    btn.addEventListener("click", () => {
      if (!app.battleView?.active) return;
      doc.querySelector?.(`.battle-deployment-btn[data-base-x="${baseX}"]`)
        ?.click?.();
    });
    biDeploys.appendChild(btn);
    deployButtons.push(btn);
  }
  infoPanel.append(
    biHead,
    biSides,
    biUnits,
    biFormationLabel,
    biFormations,
    biDeployLabel,
    biDeploys,
  );
  doc.body.appendChild(infoPanel);

  const biText = (el, value) => {
    const text = String(value ?? "");
    if (el.textContent !== text) el.textContent = text;
  };
  const biNativeWidthPct = (sel) => {
    const raw = doc.querySelector?.(sel)?.style?.width ?? "";
    const px = Number.parseFloat(raw);
    if (!Number.isFinite(px)) return 0;
    // 원본 미터는 160px 만점 (battleview meterWidth 기준).
    return Math.max(0, Math.min(100, (px / 160) * 100));
  };
  function syncBattleInfo(battle) {
    // 가로 화면에서는 카드 3열·진형 1열 배치로 패널 높이를 줄여
    // 하단 명령 도크와 겹치지 않게 한다 (세로는 기존 2열/8열 유지).
    const landscape =
      (globalThis.innerWidth ?? 0) > (globalThis.innerHeight ?? 0);
    biUnits.style.gridTemplateColumns = landscape
      ? "repeat(3,1fr)"
      : "repeat(2,1fr)";
    biFormations.style.gridTemplateColumns = landscape
      ? "repeat(16,1fr)"
      : "repeat(8,1fr)";
    infoPanel.style.maxHeight = landscape ? "64vh" : "62vh";
    // 가로에서는 절약한 높이에 배치 행까지 보이도록 절 라벨을 생략한다.
    biFormationLabel.style.display = landscape ? "none" : "";
    biDeployLabel.style.display = landscape ? "none" : "";
    for (const mirror of unitCards)
      mirror.card.style.minHeight = landscape ? "64px" : "76px";
    for (const btn of formationButtons)
      btn.style.minHeight = landscape ? "44px" : "56px";
    const open =
      battle && doc.body.classList?.contains?.("mobile-battle-biginfo");
    infoPanel.style.display = open ? "flex" : "none";
    // 패널이 열린 동안 좌측 버튼 열이 패널 내용을 가리지 않게 숨긴다.
    // 닫기는 패널 자체 닫기 버튼이 담당한다 (목록 미러와 같은 처리).
    if (open) root.style.display = "none";
    else if (!listBox.style.display || listBox.style.display === "none")
      root.style.display = "flex";
    if (!open) return;
    const q = (sel) => doc.querySelector?.(sel);
    biText(biTitle, q("#btitle")?.textContent);
    biText(biVs, q("#bbelligerents")?.textContent);
    biText(biPlayer.name, q("#batkname")?.textContent);
    biText(
      biPlayer.troops,
      `병력 ${q("#batktroops")?.textContent ?? "0"}`,
    );
    biText(
      biPlayer.morale,
      `사기 ${q("#batkmorale")?.textContent ?? "0"}`,
    );
    biPlayer.troopsFill.style.width = `${biNativeWidthPct("#batk-troops-fill")}%`;
    biPlayer.moraleFill.style.width = `${biNativeWidthPct("#batk-morale-fill")}%`;
    biText(biEnemy.name, q("#bdefname")?.textContent);
    biText(biEnemy.troops, `병력 ${q("#bdeftroops")?.textContent ?? "0"}`);
    biText(biEnemy.morale, `사기 ${q("#bdefmorale")?.textContent ?? "0"}`);
    biEnemy.troopsFill.style.width = `${biNativeWidthPct("#bdef-troops-fill")}%`;
    biEnemy.moraleFill.style.width = `${biNativeWidthPct("#bdef-morale-fill")}%`;
    const units = app.battleView?.playerUnits?.() ?? [];
    for (let i = 0; i < 6; i++) {
      const mirror = unitCards[i];
      const native = q(`#bunit${i}`);
      const unit = units[i] ?? null;
      const selected = native?.classList?.contains?.("active") ?? false;
      mirror.card.setAttribute?.("aria-pressed", String(selected));
      mirror.card.style.outline = selected ? "3px solid #ffd700" : "none";
      const routed = Boolean(
        !unit || unit.routed || unit.gone ||
          native?.classList?.contains?.("routed"),
      );
      mirror.card.style.opacity = routed ? ".45" : "1";
      biText(
        mirror.role,
        native?.querySelector?.(".battle-card-role-label")?.textContent,
      );
      const iconBg = native?.querySelector?.(".battle-card-unit-icon")?.style
        ?.backgroundImage;
      if (iconBg && mirror.icon.style.backgroundImage !== iconBg)
        mirror.icon.style.backgroundImage = iconBg;
      const statusBg = native?.querySelector?.(".battle-card-status")?.style
        ?.backgroundImage;
      if (statusBg && mirror.status.style.backgroundImage !== statusBg)
        mirror.status.style.backgroundImage = statusBg;
      biText(
        mirror.troopsVal,
        unit ? Math.max(0, unit.troops | 0) * 10 : 0,
      );
      const pct =
        unit && unit.maxTroops > 0
          ? Math.max(0, Math.min(100, (unit.troops / unit.maxTroops) * 100))
          : 0;
      mirror.troopsFill.style.width = `${pct}%`;
    }
    for (const btn of formationButtons) {
      const native = q(
        `.battle-symbol-btn[data-formation="${btn.dataset.nativeFormation}"]`,
      );
      const active = native?.classList?.contains?.("active") ?? false;
      btn.setAttribute?.("aria-pressed", String(active));
      btn.style.outline = active ? "3px solid #f0e000" : "none";
    }
    for (const btn of deployButtons) {
      const native = q(
        `.battle-deployment-btn[data-base-x="${btn.dataset.nativeBaseX}"]`,
      );
      const active = native?.classList?.contains?.("active") ?? false;
      btn.setAttribute?.("aria-pressed", String(active));
      btn.style.outline = active ? "3px solid #f0e000" : "none";
    }
  }
  function syncMobile() {
    syncList();
    const battle = Boolean(app.battleView?.active);
    battleDock.style.display = battle ? "grid" : "none";
    menu.style.display = battle ? "none" : "";
    if (battle) menuBar.style.display = "none";
    // 전투가 끝나면 패널 상태를 원복해 다음 전투는 원본 창으로 시작한다.
    if (!battle && doc.body.classList?.contains?.("mobile-battle-biginfo")) {
      doc.body.classList.remove("mobile-battle-biginfo");
      refreshInfoHighlight();
    }
    syncBattleInfo(battle);
    const viewportScale = globalThis.visualViewport?.scale || 1;
    tacticalButtons.forEach((button) => {
      button.style.minHeight = `${Math.ceil(44 / viewportScale)}px`;
      button.style.fontSize = `${Math.ceil(16 / viewportScale)}px`;
      const native = doc.querySelector?.("#" + button.dataset.nativeButton);
      button.disabled = !native || native.disabled;
      button.style.opacity = button.disabled ? ".45" : "1";
    });
  }
  const listTimer = globalThis.setInterval?.(syncMobile, 250);
  root.dataset.listSync = listTimer ? "1" : "0";

  root.appendChild(back);
  root.appendChild(info);
  root.appendChild(menu);
  doc.body.appendChild(root);
  doc.body.appendChild(menuBar);
  return root;
}
