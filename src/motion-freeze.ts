// move-위상 동결·활강 표준(단일 구현) — 세 브라우저(native·chromium windowed·offscreen)가
// 이 모듈 하나를 소비한다(재발명 금지). 판정 근거(실측): 샘플링 추종은 컴포지터 활강을 못
// 탄다 — DOM 은 매 vsync 보간되고 child 는 샘플 도착 프레임에만 움직이며, 활강 중 메인
// 스레드가 바빠 스터터가 남는다. 그래서 활강 동안 표면을 DOM 으로 바꾼다: 정착 에지에서
// 선캡처·선디코드해 둔 스냅을 move-위상 시작 에지에 <img> 스탠드인으로 세우고 네이티브
// 표면을 숨긴다. 기하 일치는 정의상 성립(스탠드인이 곧 DOM).
//
// 불변 계약:
//  - resize 위상은 절대 얼리지 않는다(freezeDecision) — 크기가 변하는 표면의 정지 사진은
//    콘텐츠 박제다(과거 freeze-frame 이 제거된 이유).
//  - bounds 커밋은 동결 중에도 유예하지 않는다 — 착지 정합은 소유자의 snapExact 가 맡는다.
//  - 숨김은 스탠드인 페인트가 커밋된 다음 프레임에(선디코드 + 더블 rAF) — 반대 순서는
//    투명 홀이 배경을 노출한다(시작 직전 깜빡의 근원, 실측).
//  - 스냅 부재·낡음·kinds 미탑재(구 코어)는 폴백 = 라이브 추종(동결 없음).

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

/** move-위상 freeze-frame 판정(순수) — 활강 중 네이티브 표면을 스탠드인 이미지로 대체할지.
 * freeze 는 오직 "move 만 활성 + 신선한 스냅 보유"일 때다. resize 가 끼면(디바이더·폭 드래그,
 * 주행 중 개입 포함) 절대 얼리지 않는다. kinds 미탑재(구 코어)도 얼리지 않는다(보수 기본값). */
export function freezeDecision(i: {
  active: boolean;
  kinds: string[] | undefined;
  snapAgeMs: number | null;
  maxAgeMs: number;
}): "freeze" | "live" {
  if (!i.active) return "live";
  if (!i.kinds || i.kinds.length === 0) return "live";
  if (i.kinds.some((k) => k !== "move")) return "live";
  if (i.snapAgeMs == null || i.snapAgeMs > i.maxAgeMs) return "live";
  return "freeze";
}

export interface MoveFreezeOptions {
  /** 스탠드인을 세울 셀 요소(활강하는 DOM 앵커). null 이면 그 시점 동작은 no-op. */
  getEl(): HTMLElement | null;
  /** 표면 rect(CSS px, 창 좌표) 캡처 → PNG data URL. */
  capture(rect: { x: number; y: number; w: number; h: number }): Promise<string>;
  /** 네이티브 표면 표시/숨김. */
  setSurfaceVisible(visible: boolean): void;
  /** 해동 시 정확 스냅 — 위상 끝의 최종 rect 로 표면을 재배치한다(소유자의 force 스냅). */
  snapExact(): void;
  /** 지금 캡처해도 되는가(표면 열림·모션 아님 등 — 소유자 판단). */
  canCapture(): boolean;
  /** 정착 스냅 신선도 상한(ms). 기본 120초 — 넘으면 freeze 대신 라이브 추종. */
  maxSnapAgeMs?: number;
}

export interface MoveFreeze {
  /** 정착 에지에서 호출 — 다음 move-위상용 스냅을 선캡처하고 즉시 디코드까지 끝내 둔다. */
  captureFresh(): void;
  /** 모션 신호 수신부 — layout.resize-gesture 페이로드를 그대로 넘긴다. */
  onMotion(payload: { active?: boolean; kinds?: string[] }): void;
  /** 현재 동결 여부. */
  frozen(): boolean;
  /** 스탠드인·상태 회수(언마운트). 표면 가시성은 소유자 수명주기가 정리한다. */
  dispose(): void;
}

export function createMoveFreeze(opts: MoveFreezeOptions): MoveFreeze {
  const maxAge = opts.maxSnapAgeMs ?? 120_000;
  let freshSnap: { img: HTMLImageElement; t: number } | null = null;
  let inFlight = false;
  let isFrozen = false;
  let freezeImg: HTMLImageElement | null = null;

  const captureFresh = (): void => {
    const el = opts.getEl();
    if (!el || !opts.canCapture() || inFlight) return;
    const r = el.getBoundingClientRect();
    const x = Math.ceil(r.left);
    const y = Math.ceil(r.top);
    const w = Math.floor(r.right) - x;
    const h = Math.floor(r.bottom) - y;
    if (w < 2 || h < 2) return;
    inFlight = true;
    void opts
      .capture({ x, y, w, h })
      .then(async (url) => {
        // 여기서 미리 디코드까지 끝내 둔다 — 동결 순간의 디코드 지연(1~2프레임)이 "표면 숨김이
        // img 페인트보다 먼저 착지 → 배경 번쩍"의 재료였다. 디코드된 요소는 append 즉시 그려진다.
        const im = new Image();
        im.src = url;
        await im.decode();
        freshSnap = { img: im, t: performance.now() };
        const cur = opts.getEl();
        if (cur) cur.dataset.bvSnapAt = String(Math.round(performance.now())); // 관측면(ui.hit)
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
      });
  };

  const applyFreeze = (on: boolean): void => {
    const el = opts.getEl();
    if (!el) return;
    if (on && !isFrozen) {
      const snap = freshSnap;
      if (!snap) return;
      const img = snap.img; // 정착 에지에서 디코드 완료 — append 즉시 페인트
      img.className = "bv-freeze-frame";
      img.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:3;";
      el.appendChild(img);
      freezeImg = img;
      isFrozen = true;
      el.dataset.bvFrozen = "1"; // 관측면(ui.hit)
      // 표면 숨김은 img 첫 페인트가 커밋된 다음 프레임에 — 반대 순서(먼저 숨김)는 홀이
      // 투명한 채 1~2프레임 배경을 노출한다(시작 직전 깜빡의 근원). img 가 표면을 덮은
      // 뒤의 한 프레임 동시 존재는 무해하다(같은 내용, 같은 자리).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (isFrozen && freezeImg === img) opts.setSurfaceVisible(false);
        }),
      );
    } else if (!on && isFrozen) {
      isFrozen = false;
      el.dataset.bvFrozen = "0";
      opts.snapExact();
      opts.setSurfaceVisible(true);
      const img = freezeImg;
      freezeImg = null;
      if (img) window.setTimeout(() => img.remove(), 90);
    }
  };

  return {
    captureFresh,
    onMotion(payload) {
      const active = !!payload.active;
      const mode = freezeDecision({
        active,
        kinds: payload.kinds,
        snapAgeMs: freshSnap ? performance.now() - freshSnap.t : null,
        maxAgeMs: maxAge,
      });
      applyFreeze(mode === "freeze");
    },
    frozen: () => isFrozen,
    dispose() {
      freezeImg?.remove();
      freezeImg = null;
      isFrozen = false;
      freshSnap = null;
    },
  };
}
