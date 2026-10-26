const LOCK_NAME = "wolong-web-game-instance";
const CHANNEL_NAME = "wolong-web-game-instance";
const FALLBACK_KEY = "wolong-web-game-instance";
const FALLBACK_TTL_MS = 3500;
const FALLBACK_HEARTBEAT_MS = 1000;

function overlay() {
  let node = document.querySelector("#instance-lock");
  if (node) return node;
  node = document.createElement("div");
  node.id = "instance-lock";
  Object.assign(node.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "pre-line",
    textAlign: "center",
    background: "#141414",
    color: "#e8d9b0",
    font: '18px/1.8 "Noto Serif TC", "PMingLiU", serif',
  });
  document.body.append(node);
  return node;
}

export function showInstanceMessage(message, blocking = true) {
  const node = overlay();
  node.textContent = message;
  node.style.display = "flex";
  node.style.pointerEvents = blocking ? "auto" : "none";
}

export function hideInstanceMessage() {
  const node = document.querySelector("#instance-lock");
  if (node) node.style.display = "none";
}

function instanceId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return (
    Array.from(bytes, (value) => value.toString(16)).join("-") ||
    `${Date.now()}-${Math.random()}`
  );
}

function openChannel() {
  if (!globalThis.BroadcastChannel) return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

function installLifecycle(stop) {
  addEventListener("pagehide", stop, { once: true });
  addEventListener("beforeunload", stop, { once: true });
  addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
}

function activeRuntime(id, kind, stop) {
  const runtime = { id, kind, state: "active", stop };
  globalThis.__dragonInstance = runtime;
  return runtime;
}

function blockExistingInstance(channel) {
  channel?.postMessage({ type: "probe" });
  showInstanceMessage(
    "와룡전이 다른 탭에서 이미 실행 중입니다.\n\n기존 게임 탭으로 전환하세요. 그 탭을 닫은 후 이 페이지를 다시 불러와 주세요.",
  );
}

/**
 * 同一浏览器 profile、同一 origin 只允许一个游戏页面初始化。
 * Web Locks 是权威实现；不支持它的浏览器采用 localStorage 心跳租约的尽力降级。
 * 两种模式都不使用服务器 API，也不会让游戏进度离开 IndexedDB。
 */
export async function startSingleInstance({
  onActive,
  onSuspend,
  onLost,
} = {}) {
  const id = instanceId();
  const channel = openChannel();
  channel?.addEventListener("message", (event) => {
    if (event.data?.type === "probe")
      channel.postMessage({ type: "active", id });
  });

  if (navigator.locks?.request) {
    showInstanceMessage("게임 탭을 확인하는 중……");
    let acquiredResolve;
    const acquired = new Promise((resolve) => {
      acquiredResolve = resolve;
    });
    let releaseResolve;
    const released = new Promise((resolve) => {
      releaseResolve = resolve;
    });
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      releaseResolve();
      channel?.postMessage({ type: "released", id });
      channel?.close();
    };
    installLifecycle(stop);

    void navigator.locks.request(
      LOCK_NAME,
      { ifAvailable: true },
      async (lock) => {
        // A lifecycle event may have stopped this page while the request queued.
        if (stopped) {
          acquiredResolve(null);
          return;
        }
        if (!lock) {
          blockExistingInstance(channel);
          stopped = true;
          channel?.close();
          acquiredResolve(null);
          return;
        }
        const runtime = activeRuntime(id, "web-lock", stop);
        hideInstanceMessage();
        onActive?.();
        acquiredResolve(runtime);
        await released;
        if (runtime.state === "active") {
          runtime.state = "stopped";
          onSuspend?.();
        }
      },
    );
    return acquired;
  }

  // localStorage 的 read/write 无法像 Web Locks 一样原子；只作为旧浏览器降级。
  // 每次 heartbeat 都重新确认所有权，检测到冲突即立即冻结，避免继续写 IndexedDB。
  if (!globalThis.localStorage) {
    showInstanceMessage(
      "이 브라우저는 단일 게임 탭 보호를 지원하지 않습니다.\nWeb Locks를 지원하는 최신 브라우저를 사용하세요.",
    );
    return null;
  }
  showInstanceMessage("게임 탭을 확인하는 중……");
  const claim = () => {
    const now = Date.now();
    let current = null;
    try {
      current = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null");
    } catch {
      // 损坏的旧记录被安全地覆盖。
    }
    if (current?.id && current.id !== id && current.expiresAt > now)
      return false;
    localStorage.setItem(
      FALLBACK_KEY,
      JSON.stringify({ id, expiresAt: now + FALLBACK_TTL_MS }),
    );
    try {
      return (
        JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null")?.id === id
      );
    } catch {
      return false;
    }
  };
  if (!claim()) {
    blockExistingInstance(channel);
    channel?.close();
    return null;
  }

  let stopped = false;
  let heartbeat = null;
  const runtime = activeRuntime(id, "local-storage-fallback", stop);
  function lose() {
    if (stopped) return;
    stopped = true;
    if (heartbeat != null) clearInterval(heartbeat);
    runtime.state = "lost";
    onLost?.();
    onSuspend?.();
    showInstanceMessage(
      "게임 탭 사용 권한을 잃어 실행을 중지했습니다.\n페이지를 새로고침하세요.",
      true,
    );
    channel?.close();
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    if (heartbeat != null) clearInterval(heartbeat);
    try {
      const current = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null");
      if (current?.id === id) localStorage.removeItem(FALLBACK_KEY);
    } catch {
      // 存储异常时页面仍必须停止。
    }
    runtime.state = "stopped";
    onSuspend?.();
    channel?.postMessage({ type: "released", id });
    channel?.close();
  }
  addEventListener("storage", (event) => {
    if (event.key !== FALLBACK_KEY || stopped) return;
    try {
      if (JSON.parse(event.newValue || "null")?.id !== id) lose();
    } catch {
      lose();
    }
  });
  installLifecycle(stop);
  heartbeat = setInterval(() => {
    if (!claim()) lose();
  }, FALLBACK_HEARTBEAT_MS);
  hideInstanceMessage();
  onActive?.();
  return runtime;
}
