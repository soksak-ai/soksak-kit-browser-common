import { describe, it, expect } from "vitest";
import { createLifecycle } from "../src/lifecycle";

// 인스턴스 경계 소유권 — dev.load 실사고의 박제: 옛 인스턴스의 디바운스 close 는 새 인스턴스가
// 재부착(claim 이전)한 서피스를 죽일 수 없다. 인스턴스 내 취소(clearTimeout)는 경계를 못 넘으므로
// 발화 시점의 claim 재확인이 유일한 방벽이다(실측: 재부착 서피스 6개가 옛 close 도착으로 전멸).
describe("claim — 인스턴스 경계의 close 경합", () => {
  it("다른 인스턴스가 재부착한 서피스는 옛 타이머가 발화해도 닫지 않는다", async () => {
    sessionStorage.clear();
    const oldInst = createLifecycle({ storagePrefix: "t-claim", closeDebounceMs: 10 });
    const newInst = createLifecycle({ storagePrefix: "t-claim", closeDebounceMs: 10 });
    oldInst.claim(7); // 생성 시 소유 기록
    let closed = 0;
    oldInst.scheduleClose(7, () => {
      closed += 1;
    }); // 옛 인스턴스 unmount
    newInst.reattach(7); // 새 인스턴스 재부착 = 소유권 이전(옛 타이머는 모름)
    await new Promise((r) => setTimeout(r, 40));
    expect(closed).toBe(0); // 이전된 소유 — 발화했지만 닫지 않음
  });

  it("아무도 재부착하지 않으면 정상적으로 닫는다", async () => {
    sessionStorage.clear();
    const inst = createLifecycle({ storagePrefix: "t-claim2", closeDebounceMs: 10 });
    inst.claim(9);
    let closed = 0;
    inst.scheduleClose(9, () => {
      closed += 1;
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(closed).toBe(1);
  });
});
