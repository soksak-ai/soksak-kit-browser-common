// 재적재 생존 수명주기 — 유령 child/서피스 방지의 단일 진실.
// 플러그인 JS 인스턴스는 webview reload(HMR/dev.load)로 정리 없이 죽고, deactivate 조차 채널이 먼저
// 죽어 엔진에 아무것도 보낼 수 없다(실측). 규칙:
//   1. 엔진 child 는 인스턴스보다 오래 산다 — 다음 인스턴스가 재부착 지도(viewId→id)로 재부착(페이지 보존).
//   2. 생성 장부는 close 가 엔진에서 확인된 때에만 지운다 — 실패한 close 가 증거를 못 지운다.
//   3. unmount 의 close 는 디바운스 — remount(재부모화·재적재 재부착)가 취소하고 재사용한다.
//   4. activate 후 reconcile 이 "장부에 있고 엔진에 살아있는데 아무도 안 잡은" id 만 회수한다.
//   5. 소유권(claim)은 인스턴스 경계를 넘는 공유 장부다 — 디바운스 취소(메모리)는 옛 인스턴스의
//      타이머에 닿지 않는다(실측: dev.load 재부착 6개를 옛 인스턴스의 close 가 도착해 전멸시킴).
//      close 타이머는 발화 시점에 claim 소유를 재확인하고, 다른 인스턴스로 이전됐으면 닫지 않는다.
// 저장은 sessionStorage(창별 + webview reload 생존 + 앱 재시작 초기화 = 엔진 child 수명과 일치).

export interface LifecycleOptions {
  /** sessionStorage 키 접두 — 플러그인별 격리(예: "soksak-offscreen"). */
  storagePrefix: string;
  /** unmount close 디바운스(ms). remount 재부착이 취소할 시간. 기본 800. */
  closeDebounceMs?: number;
}

export interface Lifecycle {
  ledgerRead(): number[];
  ledgerAdd(id: number): void;
  /** close 가 엔진에서 확인된 때에만 부른다. */
  ledgerRemove(id: number): void;
  byviewGet(viewId: string): number | undefined;
  /** 재부착 지도의 모든 id — reconcile 의 claimed 계산용(재부착 대기 중인 서피스 보호). */
  byviewValues(): number[];
  /** 재부착 지도 전체(viewId → surfaceId) — 진단·특정 서피스를 가리키는 항목 정리용. */
  byviewEntries(): Array<[string, number]>;
  byviewSet(viewId: string, id: number): void;
  byviewDelete(viewId: string): void;
  /** unmount 시 — 디바운스 후 doClose 실행. remount 의 reattach 가 취소한다.
   *  발화 시점에 claim 소유를 재확인한다 — 다른 인스턴스가 재부착(claim 이전)했으면 no-op. */
  scheduleClose(id: number, onFire: () => void): void;
  /** remount 재부착 — 디바운스 중이면 취소하고 true. claim 을 이 인스턴스로 이전한다. */
  reattach(id: number): boolean;
  /** 이 서피스의 소유를 이 인스턴스로 기록(생성·재부착 시). */
  claim(id: number): void;
  /** 소유 기록 제거(엔진 close 확인 시 — ledgerRemove 와 짝). */
  claimRelease(id: number): void;
  /** 디바운스 대기 중인 id 들(reconcile 의 claimed 계산용). */
  pendingCloseIds(): number[];
}

export function createLifecycle(opts: LifecycleOptions): Lifecycle {
  const LEDGER = `${opts.storagePrefix}-created`;
  const BYVIEW = `${opts.storagePrefix}-byview`;
  const CLAIMS = `${opts.storagePrefix}-claims`;
  const debounceMs = opts.closeDebounceMs ?? 800;
  const pendingClose = new Map<number, ReturnType<typeof setTimeout>>();
  // 인스턴스 토큰 — claim 장부(sessionStorage, 인스턴스 공유)에서 "누가 소유하는가"를 판별한다.
  const INSTANCE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function ssRead<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  function ssWrite(key: string, value: unknown): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sessionStorage 불가 환경 — 영속 없이도 기본 동작은 유지 */
    }
  }
  const claimsRead = (): Record<string, string> => ssRead<Record<string, string>>(CLAIMS, {});
  const claimWrite = (id: number, owner: string | null): void => {
    const m = claimsRead();
    if (owner) m[String(id)] = owner;
    else delete m[String(id)];
    ssWrite(CLAIMS, m);
  };

  const ledgerRead = (): number[] => {
    const v = ssRead<unknown>(LEDGER, []);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
  };
  const byviewRead = (): Record<string, number> => {
    const v = ssRead<unknown>(BYVIEW, {});
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  };

  return {
    ledgerRead,
    ledgerAdd(id) {
      const l = ledgerRead();
      if (!l.includes(id)) ssWrite(LEDGER, [...l, id]);
    },
    ledgerRemove(id) {
      ssWrite(LEDGER, ledgerRead().filter((x) => x !== id));
    },
    byviewGet(viewId) {
      return byviewRead()[viewId];
    },
    byviewValues() {
      return Object.values(byviewRead());
    },
    byviewEntries() {
      return Object.entries(byviewRead());
    },
    byviewSet(viewId, id) {
      ssWrite(BYVIEW, { ...byviewRead(), [viewId]: id });
    },
    byviewDelete(viewId) {
      const m = byviewRead();
      delete m[viewId];
      ssWrite(BYVIEW, m);
    },
    scheduleClose(id, onFire) {
      const t = setTimeout(() => {
        pendingClose.delete(id);
        // 소유권 재확인 — 디바운스 사이에 다른 인스턴스가 재부착(claim 이전)했으면 닫지 않는다.
        // 인스턴스 내 취소(clearTimeout)는 옛 인스턴스의 타이머에 닿지 않으므로 이 검사가 유일한 방벽.
        const owner = claimsRead()[String(id)];
        if (owner && owner !== INSTANCE) return;
        onFire();
      }, debounceMs);
      pendingClose.set(id, t);
    },
    reattach(id) {
      claimWrite(id, INSTANCE); // 소유권 이전 — 옛 인스턴스의 발화 대기 close 를 무력화한다
      const t = pendingClose.get(id);
      if (!t) return false;
      clearTimeout(t);
      pendingClose.delete(id);
      return true;
    },
    claim(id) {
      claimWrite(id, INSTANCE);
    },
    claimRelease(id) {
      claimWrite(id, null);
    },
    pendingCloseIds() {
      return [...pendingClose.keys()];
    },
  };
}

/** reconcile 판정(순수) — 장부에 있고 엔진에 살아있는데 아무도 안 잡은 id 만 회수 대상. */
export function reclaimTargets(input: {
  ledger: number[];
  alive: Set<number>;
  claimed: Set<number>;
}): { close: number[]; prune: number[] } {
  const close: number[] = [];
  const prune: number[] = [];
  for (const id of input.ledger) {
    if (!input.alive.has(id)) prune.push(id); // 엔진에 이미 없음 — 장부만 청소
    else if (!input.claimed.has(id)) close.push(id);
  }
  return { close, prune };
}
