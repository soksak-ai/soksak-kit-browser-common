// URL 정규화 — 주소창 입력을 로드 가능한 URL 로. 세 브라우저 플러그인이 각자 복제하던 로직의 단일 진실.
// 스킴 있음/about:/data: 은 그대로, 도메인 꼴은 https://, 그 외는 검색으로 보낸다.
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "about:blank";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.startsWith("about:") || s.startsWith("data:")) return s;
  if (/^[^\s.]+\.[^\s]+/.test(s)) return `https://${s}`;
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}
