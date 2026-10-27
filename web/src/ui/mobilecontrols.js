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
    "min-width:76px;min-height:60px;padding:10px 14px;font-size:20px;" +
    "background:rgba(20,16,8,0.85);color:#f0d8a0;border:1px solid #a08040;" +
    "border-radius:4px;touch-action:manipulation;";
  back.addEventListener("click", () => {
    if (!app.gameStarted || !app.scenario) return;
    // 우클릭과 동일한 계층 뒤로가기. 좌표는 btn===2 분기에서 사용되지 않는다.
    app.gamebar?.click(0, 0, 2, null);
    app.view?.draw();
  });

  root.appendChild(back);
  doc.body.appendChild(root);
  return root;
}
