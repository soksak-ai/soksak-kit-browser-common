// @vitest-environment jsdom
// 공유 로직 계약 테스트 — url 정규화 / 내비 상태 환원 / reconcile 판정 / 수명주기 저장·디바운스.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeUrl } from "../src/url";
import { initialNavState, renderNavState } from "../src/nav-state";
import { createLifecycle, reclaimTargets } from "../src/lifecycle";

describe("normalizeUrl", () => {
  it("스킴 있음/about:/data: 은 그대로", () => {
    expect(normalizeUrl("https://a.com")).toBe("https://a.com");
    expect(normalizeUrl("about:blank")).toBe("about:blank");
    expect(normalizeUrl("data:text/html,<b>x</b>")).toBe("data:text/html,<b>x</b>");
  });
  it("도메인 꼴은 https:// 를 붙인다", () => {
    expect(normalizeUrl("naver.com")).toBe("https://naver.com");
  });
  it("그 외는 검색 URL", () => {
    expect(normalizeUrl("한글 검색")).toContain("google.com/search?q=");
  });
  it("빈 입력은 about:blank", () => {
    expect(normalizeUrl("  ")).toBe("about:blank");
  });
});

describe("renderNavState", () => {
  it("평시: 새로고침 글리프 + 진행 바 숨김", () => {
    const r = renderNavState(initialNavState);
    expect(r).toMatchObject({ reloadGlyph: "⟳", reloadAction: "reload", progressVisible: false, backEnabled: false });
  });
  it("로딩 중: 정지 토글 + 진행 바 70%", () => {
    const r = renderNavState({ loading: true, canBack: true, canForward: false });
    expect(r).toMatchObject({ reloadGlyph: "✕", reloadAction: "stop", progressVisible: true, progressWidth: 70, backEnabled: true, forwardEnabled: false });
  });
});

describe("reclaimTargets", () => {
  it("장부에 있고 살아있는데 안 잡힌 id 만 close, 죽은 id 는 prune", () => {
    const r = reclaimTargets({ ledger: [1, 2, 3], alive: new Set([2, 3]), claimed: new Set([3]) });
    expect(r.close).toEqual([2]);
    expect(r.prune).toEqual([1]);
  });
});

describe("createLifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("장부: add 는 중복 없이, remove 는 해당 id 만", () => {
    const lc = createLifecycle({ storagePrefix: "t" });
    lc.ledgerAdd(1);
    lc.ledgerAdd(1);
    lc.ledgerAdd(2);
    expect(lc.ledgerRead()).toEqual([1, 2]);
    lc.ledgerRemove(1);
    expect(lc.ledgerRead()).toEqual([2]);
  });

  it("재부착 지도: set/get/delete + sessionStorage 영속(새 인스턴스가 읽는다)", () => {
    const a = createLifecycle({ storagePrefix: "t" });
    a.byviewSet("v1", 7);
    const b = createLifecycle({ storagePrefix: "t" }); // 재적재된 다음 인스턴스
    expect(b.byviewGet("v1")).toBe(7);
    b.byviewDelete("v1");
    expect(b.byviewGet("v1")).toBeUndefined();
  });

  it("디바운스 close: reattach 가 취소하고, 미재부착이면 발화한다", () => {
    const lc = createLifecycle({ storagePrefix: "t", closeDebounceMs: 100 });
    const fired: number[] = [];
    lc.scheduleClose(5, () => fired.push(5));
    expect(lc.pendingCloseIds()).toEqual([5]);
    expect(lc.reattach(5)).toBe(true); // remount 재부착 — 취소
    vi.advanceTimersByTime(200);
    expect(fired).toEqual([]);
    lc.scheduleClose(6, () => fired.push(6));
    vi.advanceTimersByTime(200); // 재부착 없음 — 발화
    expect(fired).toEqual([6]);
    expect(lc.pendingCloseIds()).toEqual([]);
  });
});
