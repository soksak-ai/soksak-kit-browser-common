// soksak-browser-kit — soksak 브라우저 플러그인들의 공유 셸 로직 + 드라이버 계약.
// 셸(툴바 판정·URL 정규화·수명주기·입력 포워딩)은 여기 한 곳, 백엔드 차이는 BrowserDriver 구현 하나.
export type { BrowserDriver, BrowserDriverEvents, Disposable } from "./driver";
export { normalizeUrl } from "./url";
export { initialNavState, renderNavState } from "./nav-state";
export type { NavState, NavRender } from "./nav-state";
export { createLifecycle, reclaimTargets } from "./lifecycle";
export type { Lifecycle, LifecycleOptions } from "./lifecycle";
export { forwardInput } from "./input-forward";
export type { SendInput } from "./input-forward";
export { createBrowserToolbar } from "./toolbar";
export type { BrowserToolbar, ToolbarCallbacks } from "./toolbar";
