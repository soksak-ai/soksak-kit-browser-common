// BrowserDriver — 브라우저 셸(툴바·북마크·수명주기)과 백엔드를 분리하는 계약.
// 셸은 이 인터페이스만 알고, 각 플러그인은 자기 백엔드로 이것만 구현한다:
//   native   = app.webview.* (OS 웹뷰)
//   chromium = browser-chromium 사이드카 windowed
//   chromium-offscreen = browser-chromium 사이드카 offscreen (+ input-forward)
// 어휘는 soksak-sidecar-browser-spec 과 정렬 — 드라이버가 얇게 통과시킬 수 있어야 한다.

export interface Disposable {
  dispose(): void;
}

// 엔진 → 셸 이벤트. loading 은 스피너/정지 토글·뒤로/앞으로 활성의 단일 소스.
export interface BrowserDriverEvents {
  nav: { url: string };
  title: { title: string };
  loading: { loading: boolean; canBack: boolean; canForward: boolean };
  cursor: { type: string };
  "popup-url": { url: string };
}

export interface BrowserDriver {
  navigate(url: string): void;
  back(): void;
  forward(): void;
  reload(ignoreCache?: boolean): void;
  stop(): void;
  bounds(x: number, y: number, w: number, h: number): void;
  hidden(hidden: boolean): void;
  focus(): void;
  close(): void;
  on<K extends keyof BrowserDriverEvents>(
    event: K,
    cb: (payload: BrowserDriverEvents[K]) => void,
  ): Disposable;
}
