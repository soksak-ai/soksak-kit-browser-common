// 툴바 내비 상태 모델 — 엔진 loading 이벤트를 툴바 표시로 환원하는 순수 로직(프레임워크 무관).
// reload 버튼의 정지(✕) 토글, 진행 바 표시, 뒤로/앞으로 활성이 이 하나에서 나온다.
// React(browser-view)든 vanilla(offscreen)든 같은 판정을 소비한다 — 표시 드리프트 방지.

export interface NavState {
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
}

export const initialNavState: NavState = { loading: false, canBack: false, canForward: false };

export interface NavRender {
  /** reload 자리 버튼의 글리프 — 로딩 중 정지(✕), 평시 새로고침(⟳). */
  reloadGlyph: "✕" | "⟳";
  /** reload 자리 버튼 클릭이 보낼 동작. */
  reloadAction: "stop" | "reload";
  /** 진행 바 표시 여부(불확정 진행). */
  progressVisible: boolean;
  /** 진행 바 폭(%) — 로딩 중 70, 완료 시 100(채운 뒤 페이드아웃). */
  progressWidth: 70 | 100;
  backEnabled: boolean;
  forwardEnabled: boolean;
}

export function renderNavState(s: NavState): NavRender {
  return {
    reloadGlyph: s.loading ? "✕" : "⟳",
    reloadAction: s.loading ? "stop" : "reload",
    progressVisible: s.loading,
    progressWidth: s.loading ? 70 : 100,
    backEnabled: s.canBack,
    forwardEnabled: s.canForward,
  };
}
