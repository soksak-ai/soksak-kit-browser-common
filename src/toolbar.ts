// 공용 브라우저 툴바 — 세 브라우저(native/chromium/chromium-offscreen)가 같은 DOM·같은 노드 주소·
// 같은 외형을 갖게 하는 단일 구현. React 뷰는 ref 컨테이너에 mount 하고, vanilla 뷰는 그대로 쓴다.
// 판정(글리프·활성·진행 바)은 nav-state 가 단일 진실이고, 여기는 그것을 DOM 에 반영만 한다.
// 플러그인 고유 버튼(devtools 등)은 extraSlot 에 append 한다 — 공통부는 여기서만 진화한다.
import { renderNavState, initialNavState, type NavState } from "./nav-state";

export interface ToolbarCallbacks {
  onNavigate(rawInput: string): void;
  onBack(): void;
  onForward(): void;
  onReload(): void;
  onStop(): void;
  onHome(): void;
  onBookmarkToggle(): void;
}

export interface BrowserToolbar {
  /** 툴바 루트 요소(컨테이너에 이미 붙어 있음). */
  root: HTMLElement;
  /** 플러그인 고유 버튼을 붙이는 확장 슬롯(북마크 별 오른쪽). */
  extraSlot: HTMLElement;
  setUrl(url: string): void;
  getInput(): string;
  setNavState(state: NavState): void;
  setBookmarked(on: boolean): void;
  dispose(): void;
}

function btn(node: string, label: string, title: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("data-node", node);
  b.textContent = label;
  b.title = title;
  // 색은 코어 테마 계약(soksak-theme-spec v1)의 토큰 슬롯만 소비한다 — 존재하지 않는 변수를
  // 발명하면 폴백이 조용히 적용되어 테마(라이트/다크)를 무시한다(실측: 라이트에서 다크 툴바).
  // 툴바 행 계약(코어 PLUGIN-CONTRACT §Toolbar row) — 행 치수는 테마 토큰이 소유하므로
  // 컨트롤은 행(--toolbar-h)에 들어맞는 고정 22px 로 맞춘다.
  b.style.cssText =
    "flex:0 0 auto;width:26px;height:22px;border-radius:6px;border:0;" +
    "background:var(--inset);color:var(--fg);" +
    "font:13px system-ui;cursor:pointer";
  return b;
}

export function createBrowserToolbar(
  container: HTMLElement,
  cb: ToolbarCallbacks,
): BrowserToolbar {
  const bar = document.createElement("div");
  bar.setAttribute("data-node", "toolbar");
  // 툴바 행 계약(코어 PLUGIN-CONTRACT §Toolbar row) — 치수는 테마 토큰 소유, 자체 재창조 금지.
  bar.style.cssText =
    "position:relative;display:flex;gap:4px;flex:0 0 auto;align-items:center;" +
    "height:var(--toolbar-h,28px);padding:0 var(--toolbar-pad-x,8px);" +
    "background:var(--side);border-bottom:1px solid var(--bd)"; // 페이지와의 경계(라이트에서 면 톤이 같음)

  const back = btn("back", "‹", "뒤로");
  const forward = btn("forward", "›", "앞으로");
  const reload = btn("reload", "⟳", "새로고침"); // 로딩 중 ✕(정지) 토글 — setNavState 가 관리
  const home = btn("home", "⌂", "홈");
  const url = document.createElement("input");
  url.setAttribute("data-node", "urlbar");
  url.type = "text";
  url.placeholder = "URL 또는 검색어";
  url.style.cssText =
    "flex:1 1 auto;height:22px;box-sizing:border-box;padding:0 10px;border-radius:6px;" +
    "border:1px solid var(--bd);" +
    "background:var(--inset);color:var(--fg);font:12px system-ui";
  const go = btn("go", "↵", "이동");
  go.style.background = "var(--acc)";
  go.style.color = "var(--bg)"; // 액센트 위 대비색 — 테마의 배경색이 액센트의 반대 극이다
  const star = btn("bookmark", "☆", "북마크");
  const extraSlot = document.createElement("div");
  extraSlot.setAttribute("data-node", "extra");
  extraSlot.style.cssText = "display:flex;gap:4px;flex:0 0 auto;align-items:center";
  const progress = document.createElement("div");
  progress.setAttribute("data-node", "progress");
  progress.style.cssText =
    "position:absolute;left:0;bottom:0;height:2px;width:0;" +
    "background:var(--acc);transition:width .25s ease-out;opacity:0";

  bar.append(back, forward, reload, home, url, go, star, extraSlot, progress);
  container.appendChild(bar);

  let nav: NavState = initialNavState;
  const apply = (): void => {
    const r = renderNavState(nav);
    reload.textContent = r.reloadGlyph;
    reload.title = r.reloadAction === "stop" ? "정지" : "새로고침";
    progress.style.opacity = r.progressVisible ? "1" : "0";
    progress.style.width = `${r.progressWidth}%`;
    back.style.opacity = r.backEnabled ? "1" : "0.35";
    forward.style.opacity = r.forwardEnabled ? "1" : "0.35";
  };
  apply();

  back.addEventListener("click", () => {
    if (renderNavState(nav).backEnabled) cb.onBack();
  });
  forward.addEventListener("click", () => {
    if (renderNavState(nav).forwardEnabled) cb.onForward();
  });
  reload.addEventListener("click", () => {
    if (renderNavState(nav).reloadAction === "stop") cb.onStop();
    else cb.onReload();
  });
  home.addEventListener("click", () => cb.onHome());
  go.addEventListener("click", () => cb.onNavigate(url.value));
  url.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      cb.onNavigate(url.value);
      url.blur();
    }
  });
  star.addEventListener("click", () => cb.onBookmarkToggle());

  return {
    root: bar,
    extraSlot,
    setUrl(u) {
      if (document.activeElement !== url) url.value = u; // 직접 입력 중엔 방해하지 않는다
    },
    getInput() {
      return url.value;
    },
    setNavState(s) {
      nav = s;
      apply();
    },
    setBookmarked(on) {
      star.textContent = on ? "★" : "☆";
    },
    dispose() {
      bar.remove();
    },
  };
}
