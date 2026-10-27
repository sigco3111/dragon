// 输入处理 — 滚轮缩放 / 拖拽平移 / 悬停拾取 / 点击选择
export function attachInput(view, { onHover, onSelect, uiHit, onWheel }) {
  const cv = view.cv;
  let drag = null;

  window.addEventListener(
    "wheel",
    (e) => {
      // DOM 보조 목록/하단 메뉴는 브라우저 기본 스크롤을 사용한다.
      // 전략 canvas의 wheel만 기존 목록 경로로 보낸다.
      if (e.target?.closest?.("#mobilecontrols-list, #mobilecontrols-menubar")) return;
      e.preventDefault();
      onWheel?.(e);
    },
    { passive: false },
  );

  // 한 손가락 드래그(맵 팬)는 그대로 pointer 이벤트로 받고, 두 손가락 핀치는
  // 브라우저 네이티브 확대/축소에 양보한다 (모바일 작은 글씨 대응, 표시 전용).
  cv.style.touchAction = "pinch-zoom";
  // 핀치 시작 시 브라우저가 제스처를 가로채며 pointercancel이 오므로
  // 진행 중이던 드래그 상태를 반드시 해제한다 (맵이 팬 상태로 멈추는 것 방지).
  cv.addEventListener("pointercancel", () => {
    drag = null;
  });
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // 仅左键触发地图拖拽平移
    drag = {
      mx: e.clientX,
      my: e.clientY,
      moved: false,
      ui: uiHit?.(e.clientX, e.clientY),
    };
  });

  // 右键点击处理 (contextmenu): 优先派发给 onSelect 处理 UI/层级回退
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    drag = null; // 右键立即打断任何拖拽状态
    onSelect?.(view.pick(e.clientX, e.clientY), e);
  });

  addEventListener("pointerup", (e) => {
    if (e.button === 0) {
      if (drag && !drag.moved) onSelect?.(view.pick(e.clientX, e.clientY), e);
      drag = null;
    }
  });

  addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.mx,
        dy = e.clientY - drag.my;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (!drag.ui) {
        view.pan(dx, dy);
      }
      drag.mx = e.clientX;
      drag.my = e.clientY;
      view.draw();
    } else {
      onHover?.(view.pick(e.clientX, e.clientY), e);
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "0") {
      view.fit();
      view.draw();
    }
  });
  addEventListener("resize", () => {
    view.clampCam?.(); // 窗口变化后重新钳制地图边界
    view.draw();
  });
}
