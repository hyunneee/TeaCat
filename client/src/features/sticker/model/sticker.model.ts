import { DOODLE_EXPORT_SIZE, type Point, type Stroke } from './sticker.types';

/**
 * 순수 함수만. React·DOM 상태를 모릅니다 (캔버스 2D 컨텍스트는 인자로 받습니다).
 * 그래서 화면과 내보내기가 **같은 함수로 같은 그림**을 만듭니다 —
 * 화면에 보인 것과 서버가 받는 것이 달라질 여지가 없습니다.
 */

/** 획 하나를 그립니다. `size` 는 그릴 캔버스의 한 변(px, 정사각). */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, size: number) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  /* 굵기는 1024 기준값을 캔버스 크기에 비례해 줄입니다. 화면(≈340px)에서는 1/3 로 보이고
     서버로 보낼 때(1024)는 저장된 값 그대로 — 어느 쪽에서 봐도 선의 비율이 같습니다. */
  ctx.lineWidth = (stroke.width * size) / DOODLE_EXPORT_SIZE;
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first!.x * size, first!.y * size);
  if (rest.length === 0) {
    // 점 하나만 찍은 경우 — lineTo 가 없으면 아무것도 안 그려집니다
    ctx.lineTo(first!.x * size + 0.01, first!.y * size);
  }
  for (const p of rest) ctx.lineTo(p.x * size, p.y * size);
  ctx.stroke();
  ctx.restore();
}

/** 흰 바탕을 깔고 모든 획을 그립니다. */
export function renderDoodle(ctx: CanvasRenderingContext2D, strokes: Stroke[], size: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  for (const s of strokes) drawStroke(ctx, s, size);
}

/** 그린 것이 있나 — 지우개만 쓴 경우는 "그림 없음" 입니다 */
export function hasInk(strokes: Stroke[]): boolean {
  return strokes.some((s) => s.tool === 'pen' && s.points.length > 0);
}

/**
 * 획을 정규화 좌표로 바꿉니다. 캔버스 바깥으로 나간 포인터는 가장자리로 붙입니다 —
 * 밖에서 들어오는 선이 허공에서 시작하지 않게.
 */
export function toNormalized(clientX: number, clientY: number, rect: DOMRect): Point {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

/**
 * 서버로 보낼 PNG 를 만듭니다 (설계·구현 계획 3-0: 파일 선택 창이 아니라 캔버스에서 바로).
 *
 * 화면 캔버스를 그대로 쓰지 않고 **새 캔버스에 1024 로 다시 그립니다.** 화면 캔버스는
 * 레티나 배율이 섞여 있어 기기마다 크기가 달라지는데, 서버는 늘 같은 크기를 받아야 합니다.
 * 워커가 여백을 자르고 크기를 맞추므로 여기서 더 손대지 않습니다.
 */
export function exportDoodlePng(strokes: Stroke[], size = DOODLE_EXPORT_SIZE): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas 2d context 를 만들 수 없습니다'));
  renderDoodle(ctx, strokes, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG 로 변환하지 못했습니다'));
    }, 'image/png');
  });
}

/** Blob → base64 본문 (data URL 접두어 없이). 서버 계약이 `sketchBase64` 라서 씁니다. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('base64 변환 실패'));
    reader.readAsDataURL(blob);
  });
}
