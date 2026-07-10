// dom.* JS 스니펫 단일 소스 — 세 브라우저(native/chromium/chromium-offscreen)가 같은 본문을
// 실행해 dom 커맨드의 행동(AI/E2E 계약)이 엔진과 무관하게 동일해진다. 본문은 native 의 코어
// evalInBrowser 이식본에서 추출한 원문 그대로다 — 문구를 바꾸면 세 브라우저의 행동이 갈린다.
// 본문 계약: async 함수 본문(await 허용), JSON 직렬화 가능 값을 return 한다.

/** JS 문자열 리터럴 이스케이프(선택자/텍스트 임베드용). */
export const jsStr = (s: string): string => JSON.stringify(s);

/** 페이지/선택자 가시 텍스트. */
export function domTextBody(selector: string | undefined, maxLength = 20000): string {
  return selector
    ? `const el = document.querySelector(${jsStr(selector)}); return el ? el.innerText.slice(0, ${maxLength}) : null;`
    : `return document.body.innerText.slice(0, ${maxLength});`;
}

/** 페이지/선택자 HTML. */
export function domHtmlBody(selector: string | undefined, maxLength = 20000): string {
  return selector
    ? `const el = document.querySelector(${jsStr(selector)}); return el ? el.outerHTML.slice(0, ${maxLength}) : null;`
    : `return document.documentElement.outerHTML.slice(0, ${maxLength});`;
}

/** 매칭 요소 요약(tag/text/attrs) — 페이지 구조 파악. */
export function domQueryBody(selector: string, limit = 20): string {
  return `
          const all = [...document.querySelectorAll(${jsStr(selector)})];
          return { count: all.length, elements: all.slice(0, ${limit}).map(e => ({
            tag: e.tagName.toLowerCase(),
            text: (e.innerText || "").trim().slice(0, 120) || undefined,
            id: e.id || undefined,
            class: (typeof e.className === "string" && e.className) || undefined,
            name: e.getAttribute("name") || undefined,
            href: e.getAttribute("href") || undefined,
            type: e.getAttribute("type") || undefined,
            value: e.value !== undefined ? String(e.value).slice(0, 120) : undefined,
          })) };`;
}

/** 첫 매칭 요소 클릭. */
export function domClickBody(selector: string): string {
  return `const el = document.querySelector(${jsStr(selector)}); if (!el) return { clicked: false, reason: "selector 매칭 없음" }; el.click(); return { clicked: true };`;
}

/** input 값 채우기(input/change 발화 — React 호환). */
export function domFillBody(selector: string, text: string): string {
  return `
          const el = document.querySelector(${jsStr(selector)});
          if (!el) return { filled: false, reason: "selector 매칭 없음" };
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(el, ${jsStr(text)}); else el.value = ${jsStr(text)};
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return { filled: true };`;
}

/** 폼 제출(selector 는 form 자체 또는 내부 요소). */
export function domSubmitBody(selector: string): string {
  return `
          const el = document.querySelector(${jsStr(selector)});
          if (!el) return { submitted: false, reason: "selector 매칭 없음" };
          const form = el instanceof HTMLFormElement ? el : el.closest("form");
          if (!form) return { submitted: false, reason: "form 없음" };
          form.requestSubmit ? form.requestSubmit() : form.submit();
          return { submitted: true };`;
}

/** 선택자 출현 대기(MutationObserver — 동적 페이지). */
export function domWaitForBody(selector: string, timeoutMs = 5000): string {
  return `
          const find = () => document.querySelector(${jsStr(selector)});
          if (find()) return { found: true };
          return await new Promise((resolve) => {
            const obs = new MutationObserver(() => {
              if (find()) { obs.disconnect(); clearTimeout(timer); resolve({ found: true }); }
            });
            const timer = setTimeout(() => { obs.disconnect(); resolve({ found: false }); }, ${timeoutMs});
            obs.observe(document.documentElement, { childList: true, subtree: true });
          });`;
}
