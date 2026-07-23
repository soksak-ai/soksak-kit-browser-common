// @vitest-environment jsdom
// 공용 툴바 계약 — 노드 주소, 판정 반영(reload↔stop 토글·활성 흐림·진행 바), 콜백 라우팅.
import { describe, expect, it, vi } from "vitest";
import { createBrowserToolbar } from "../src/toolbar";

function make() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const cb = {
    onNavigate: vi.fn(), onBack: vi.fn(), onForward: vi.fn(),
    onReload: vi.fn(), onStop: vi.fn(), onHome: vi.fn(), onBookmarkToggle: vi.fn(),
  };
  return { tb: createBrowserToolbar(container, cb), cb, container };
}
const node = (c: HTMLElement, n: string) => c.querySelector(`[data-node="${n}"]`) as HTMLElement;

describe("createBrowserToolbar", () => {
  it("공통 노드 주소가 전부 존재한다(세 브라우저 동일 E2E 표면)", () => {
    const { container } = make();
    for (const n of ["toolbar","back","forward","reload","home","urlbar","go","bookmark","extra","progress"])
      expect(node(container, n), n).toBeTruthy();
  });

  it("로딩 상태: reload 가 정지(✕)로 토글되고 클릭이 onStop 으로 간다", () => {
    const { tb, cb, container } = make();
    tb.setNavState({ loading: true, canBack: false, canForward: false });
    const reload = node(container, "reload");
    expect(reload.textContent).toBe("✕");
    reload.click();
    expect(cb.onStop).toHaveBeenCalledTimes(1);
    expect(cb.onReload).not.toHaveBeenCalled();
    tb.setNavState({ loading: false, canBack: false, canForward: false });
    expect(reload.textContent).toBe("⟳");
    reload.click();
    expect(cb.onReload).toHaveBeenCalledTimes(1);
  });

  it("히스토리 없음: back/forward 클릭은 무시되고 흐려진다", () => {
    const { cb, container } = make();
    node(container, "back").click();
    node(container, "forward").click();
    expect(cb.onBack).not.toHaveBeenCalled();
    expect(cb.onForward).not.toHaveBeenCalled();
    expect(node(container, "back").style.opacity).toBe("0.35");
  });

  it("go/Enter 는 입력값으로 onNavigate, home 은 onHome, 별은 onBookmarkToggle", () => {
    const { tb, cb, container } = make();
    const url = node(container, "urlbar") as HTMLInputElement;
    url.value = "naver.com";
    node(container, "go").click();
    expect(cb.onNavigate).toHaveBeenCalledWith("naver.com");
    node(container, "home").click();
    expect(cb.onHome).toHaveBeenCalledTimes(1);
    node(container, "bookmark").click();
    expect(cb.onBookmarkToggle).toHaveBeenCalledTimes(1);
    tb.setBookmarked(true);
    expect(node(container, "bookmark").textContent).toBe("★");
  });

  it("setUrl 은 사용자가 입력 중이면 덮지 않는다", () => {
    const { tb, container } = make();
    const url = node(container, "urlbar") as HTMLInputElement;
    url.focus();
    url.value = "typing...";
    tb.setUrl("https://a.com");
    expect(url.value).toBe("typing...");
    url.blur();
    tb.setUrl("https://a.com");
    expect(url.value).toBe("https://a.com");
  });

  it("툴바 행 계약 — 행 치수는 테마 토큰을 소비한다(자체 재창조 금지)", () => {
    const { container } = make();
    const bar = node(container, "toolbar");
    expect(bar.style.height).toMatch(/var\(--toolbar-h/);
    expect(bar.style.padding).toMatch(/var\(--toolbar-pad-x/);
  });
});
