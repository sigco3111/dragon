// 표시 계층 패치: 캔버스 글자 그리기와 DOM 텍스트에서 한자 인명·지명을 한글 표기로 바꿔 보여 준다.
// 게임 데이터·내부 ID·저장 형식은 바꾸지 않는다. (원본 이름은 data 그대로 유지)
import { koreanDisplay } from "./koreannames.js";

const cache = new Map();
function conv(text) {
  if (typeof text !== "string") return text;
  let v = cache.get(text);
  if (v === undefined) {
    v = koreanDisplay(text);
    if (cache.size > 4000) cache.clear();
    cache.set(text, v);
  }
  return v;
}
const debug = (globalThis.__koNameDebug = { seen: new Set(), on: false });
function note(text) {
  if (debug.on && /[\u3400-\u9fff]/.test(text) && debug.seen.size < 800) debug.seen.add(text);
}

const HANGUL = /[\uac00-\ud7a3]/;
// 지도 거점 라벨 등은 Noto Serif TC/PMingLiU만 지정해 한글 글리프가 없다. 바뀐 한글 이름에 한해 KR 글꼴을 앞에 붙인다.
function withKrFont(ctx, orig, text, changed, args) {
  if (changed && HANGUL.test(text)) {
    const f = ctx.font;
    if (typeof f === "string" && !f.includes("Noto Serif KR")) {
      ctx.font = f.replace(/(px\s+)/, '$1"Noto Serif KR",');
      try {
        return orig.call(ctx, text, ...args);
      } finally {
        ctx.font = f;
      }
    }
  }
  return orig.call(ctx, text, ...args);
}

function patchCtx(proto) {
  if (!proto || proto.__koNamesPatched) return;
  proto.__koNamesPatched = true;
  for (const name of ["fillText", "strokeText"]) {
    const orig = proto[name];
    if (typeof orig !== "function") continue;
    proto[name] = function (text, ...rest) {
      const raw = String(text ?? "");
      const t = conv(raw);
      note(t);
      return withKrFont(this, orig, t, t !== raw, rest);
    };
  }
  const measure = proto.measureText;
  if (typeof measure === "function") {
    proto.measureText = function (text) {
      const raw = String(text ?? "");
      const t = conv(raw);
      return withKrFont(this, measure, t, t !== raw, []);
    };
  }
}
patchCtx(globalThis.CanvasRenderingContext2D?.prototype);
patchCtx(globalThis.OffscreenCanvasRenderingContext2D?.prototype);

function convertNode(node) {
  if (node.nodeType === 3) {
    const p = node.parentNode?.nodeName;
    if (p === "SCRIPT" || p === "STYLE") return;
    const v = node.nodeValue;
    if (v && /[\u3400-\u9fff]/.test(v)) {
      const c = conv(v);
      if (c !== v) node.nodeValue = c;
    }
  } else if (node.nodeType === 1) {
    for (let n = node.firstChild; n; n = n.nextSibling) convertNode(n);
  }
}
if (typeof MutationObserver !== "undefined" && globalThis.document) {
  const start = () => {
    const root = document.documentElement;
    if (!root) return;
    convertNode(root);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") convertNode(r.target);
        else for (const n of r.addedNodes) convertNode(n);
      }
    }).observe(root, { subtree: true, childList: true, characterData: true });
  };
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
