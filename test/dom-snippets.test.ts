import { describe, it, expect } from "vitest";
import {
  jsStr,
  domTextBody,
  domClickBody,
  domFillBody,
  domQueryBody,
} from "../src/dom-snippets";

// 스니펫은 세 브라우저의 공용 계약 — 리터럴 임베드가 안전(따옴표/역슬래시 주입 불가)해야 한다.
describe("dom-snippets", () => {
  it("jsStr 은 따옴표·개행을 JS 리터럴로 안전 이스케이프한다", () => {
    expect(jsStr('a"b\n')).toBe('"a\\"b\\n"');
  });
  it("선택자가 본문에 이스케이프되어 임베드된다", () => {
    const body = domClickBody('button[title="x"]');
    expect(body).toContain('document.querySelector("button[title=\\"x\\"]")');
  });
  it("fill 은 값도 리터럴로 임베드하고 input/change 를 발화한다", () => {
    const body = domFillBody("#q", 'he"llo');
    expect(body).toContain('"he\\"llo"');
    expect(body).toContain('new Event("input"');
    expect(body).toContain('new Event("change"');
  });
  it("text/query 는 상한을 숫자로 임베드한다", () => {
    expect(domTextBody(undefined, 500)).toContain(".slice(0, 500)");
    expect(domQueryBody("a", 7)).toContain(".slice(0, 7)");
  });
});
