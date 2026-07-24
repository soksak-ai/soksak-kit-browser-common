// 추종 송신 정책(단일 구현) — 세 브라우저가 이 모듈을 소비한다(재발명 금지).
// 동결·활강 기계는 코어 슬롯 동결(NATIVE-SURFACES §4.6)로 승격됐다 — 플러그인 의무는
// transparent 선언과 view.veiled 릴레이뿐이고, 여기 남는 것은 송신자 소유 정책이다.

/** 1프레임 선행 외삽(순수) — 모션 위상 중 송신 위치를 다음 표시 프레임의 예상 위치로 민다.
 * rAF 가 읽는 rect 는 "지금 화면 위치"고 setFrame 은 다음 리프레시에 그려지므로, 표시 시점엔
 * DOM 이 정확히 한 프레임 앞서 있다 — 격차 = 속도×1프레임(강조바는 마우스 속도라 지각 밖,
 * FLIP 주행은 프레임당 수십 px 라 벌어져 보인다). 연속 두 샘플의 델타를 한 번 더 밀어 상쇄한다.
 * 정지·직전샘플 부재·teleport(재배치 점프) 는 실측 그대로 — 외삽은 등속 구간에서만 이득이다. */
export function leadPosition(i: {
  prev: { x: number; y: number } | null;
  cur: { x: number; y: number };
  moving: boolean;
  teleportPx: number;
}): { x: number; y: number } {
  if (!i.moving || !i.prev) return i.cur;
  const dx = i.cur.x - i.prev.x;
  const dy = i.cur.y - i.prev.y;
  if (dx === 0 && dy === 0) return i.cur;
  if (Math.abs(dx) > i.teleportPx || Math.abs(dy) > i.teleportPx) return i.cur;
  return { x: i.cur.x + dx, y: i.cur.y + dy };
}
