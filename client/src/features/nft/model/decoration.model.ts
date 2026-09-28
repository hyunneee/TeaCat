import {
  PLACED_MAX_COUNT,
  PLACED_MAX_SCALE,
  PLACED_MIN_SCALE,
  type Placed,
  type PlacedRecord,
} from './decoration.types';

/**
 * 포카 꾸미기 — 계산만 하는 곳.
 *
 * 🔴 **이 파일은 React·훅을 쓰지 않습니다.** 나중에 테스트 도구를 넣으면 이 파일만 바로
 *    시험할 수 있게 순수하게 둡니다. (`document.createElement('canvas')` 는 합성에
 *    반드시 필요해서 예외입니다 — 그 밖의 DOM 은 인자로 받습니다)
 */

export function clampScale(scale: number): number {
  return Math.min(PLACED_MAX_SCALE, Math.max(PLACED_MIN_SCALE, scale));
}

/** 카드 밖으로 완전히 빠져나가지 않게. 중심이 카드 안에는 있어야 집을 수 있습니다 */
export function clampPosition(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 서버에 보낼 배치 문자열.
 *
 * 🔴 `url` 은 **빼고 보냅니다.** presigned 라 만료돼서, 넣어 두면 다음에 열었을 때
 *    죽은 주소가 복원됩니다. 복원은 `stickerId` 로 내 스티커 목록에서 새로 찾습니다.
 */
export function serializePlacements(placed: Placed[]): string {
  const records: PlacedRecord[] = placed.map(({ id, stickerId, x, y, scale, rotation }) => ({
    id,
    stickerId,
    x,
    y,
    scale,
    rotation,
  }));
  return JSON.stringify(records);
}

/**
 * 저장해 둔 배치를 화면에 올릴 수 있는 모양으로 되돌립니다.
 *
 * `urlOf` 는 `stickerId` → 지금 유효한 그림 주소입니다.
 * ⚠️ **그 사이에 지운 스티커는 되살아나지 않습니다** — 주소가 없으니 빼고 복원합니다.
 * 저장된 그림(`decoratedImageUrl`)에는 남아 있지만 다시 꾸미기에서는 손댈 수 없습니다.
 *
 * 남이 만든 문자열이 아니라 우리가 넣은 값이지만, 서버에 그대로 저장되는 문자열이라
 * **모양이 어긋나도 화면이 죽지 않게** 전부 걸러냅니다.
 */
export function parsePlacements(json: string, urlOf: (stickerId: number) => string | undefined): Placed[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const placed: Placed[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Partial<PlacedRecord>;
    if (typeof r.stickerId !== 'number') continue;
    const url = urlOf(r.stickerId);
    if (!url) continue; // 지워진 스티커
    placed.push({
      id: typeof r.id === 'string' && r.id ? r.id : newPlacedId(),
      stickerId: r.stickerId,
      url,
      x: clampPosition(Number(r.x) || 0),
      y: clampPosition(Number(r.y) || 0),
      scale: clampScale(Number(r.scale) || PLACED_MIN_SCALE),
      rotation: Number(r.rotation) || 0,
    });
    if (placed.length >= PLACED_MAX_COUNT) break;
  }
  return placed;
}

/** 화면용 id. 같은 스티커를 두 번 올릴 수 있어 `stickerId` 로는 구분이 안 됩니다 */
export function newPlacedId(): string {
  return crypto.randomUUID();
}

/**
 * 카드 위에 스티커를 얹어 PNG 로 만듭니다.
 *
 * 🔴 **이미 화면에 떠 있는 `HTMLImageElement` 를 그대로 받습니다.** 여기서 `new Image()` 로
 *    다시 받으면 안 됩니다 — 스티커 주소가 **10분짜리 presigned** 라, 10분 넘게 꾸미다
 *    저장을 누르면 새 요청은 403 입니다. 이미 받아 둔 것은 만료와 무관합니다.
 *
 * 🔴 그 `<img>` 에는 **`crossOrigin="anonymous"` 가 붙어 있어야 합니다.** 없으면 브라우저가
 *    CORS 없이 받아오고, 서버가 허락했든 말든 캔버스를 잠가 `toBlob()` 이 `SecurityError` 로
 *    실패합니다. 붙였는데 그림이 아예 안 뜬다면 그건 응답에 CORS 헤더가 없다는 뜻입니다.
 *
 * 화면의 CSS 와 **같은 순서**(중심 이동 → 회전 → 폭 = 카드 폭 × scale)로 그립니다.
 * 순서나 기준이 다르면 화면과 결과물이 어긋납니다.
 */
export function composeDecorated(
  card: HTMLImageElement,
  placed: Placed[],
  imgs: Map<string, HTMLImageElement>,
): Promise<Blob> {
  const w = card.naturalWidth;
  const h = card.naturalHeight;
  if (!w || !h) return Promise.reject(new Error('카드 그림을 아직 다 받지 못했습니다'));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas 2d context 를 만들 수 없습니다'));

  ctx.drawImage(card, 0, 0, w, h);

  for (const p of placed) {
    const img = imgs.get(p.id);
    if (!img || !img.complete || img.naturalWidth === 0) continue; // 못 받은 건 건너뜁니다

    const drawW = w * clampScale(p.scale);
    const drawH = drawW * (img.naturalHeight / img.naturalWidth);

    ctx.save();
    ctx.translate(p.x * w, p.y * h);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      /* 대개 캔버스가 잠긴 경우입니다 — 위 crossOrigin 주석을 보세요 */
      else reject(new Error('PNG 로 변환하지 못했습니다'));
    }, 'image/png');
  });
}
