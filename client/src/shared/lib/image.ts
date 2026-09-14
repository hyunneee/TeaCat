/**
 * 업로드 전 이미지 줄이기.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────
 * 운영자가 올린 원본이 그대로 서빙되고 있었습니다. 서버는 크기만 검사하고(포스터 5MB,
 * 상세 이미지 20MB) 변환하지 않고, 업로드도 브라우저 → 스토리지 직접(presigned PUT)이라
 * 서버가 파일을 볼 기회조차 없습니다. 그래서 홈 한 화면에 이미지가 18MB 내려왔고
 * Lighthouse 의 LCP 가 19초였습니다. 줄일 수 있는 유일한 지점이 **올리기 직전**입니다.
 *
 * ── 왜 WebP 인가 ──────────────────────────────────────────
 * 투명도를 유지하면서 JPEG 보다 작습니다. 서버 허용 목록에 이미 있습니다
 * (`ImageFiles.ALLOWED_TYPES`). PNG 로고가 섞인 배너를 JPEG 로 바꾸면 배경이 검게 됩니다.
 *
 * 🔴 **얼굴 이미지에는 쓰지 마세요.** 얼굴은 브라우저 안에서 임베딩만 뽑고 원본은
 *    기기를 떠나지 않습니다 (CLAUDE.md 7장). 이 함수는 공연 포스터·배너·상세 이미지처럼
 *    **원래 공개되는 그림** 전용입니다. `features/face` 에서 이 파일을 import 하면
 *    그건 규칙 위반입니다.
 */

export interface DownscaleOptions {
  /** 이 폭을 넘으면 줄입니다. 원본이 더 작으면 **늘리지 않습니다** */
  maxWidth: number;
  /** WebP 품질 (0~1). 0.82 면 눈으로 차이를 못 느끼면서 크게 줄어듭니다 */
  quality?: number;
}

/** 애니메이션이 한 장으로 납작해지므로 GIF 는 건드리지 않습니다 */
const SKIP_TYPES = new Set(['image/gif']);

/**
 * 긴 변을 `maxWidth` 이하로 줄이고 WebP 로 다시 인코딩합니다.
 *
 * **실패하면 원본을 그대로 돌려줍니다.** 이미지를 줄이는 건 최적화이고, 그것 때문에
 * 업로드 자체가 막히면 안 됩니다 (오래된 브라우저·이상한 파일·메모리 부족).
 *
 * @returns 새 `File`. 이름은 확장자만 `.webp` 로 바뀝니다
 */
export async function downscaleImage(file: File, options: DownscaleOptions): Promise<File> {
  const { maxWidth, quality = 0.82 } = options;

  if (SKIP_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);

    /* 긴 변을 기준으로 합니다. 상세 이미지는 세로로 아주 길어서 폭만 보면
       (예: 800×6000) 줄일 필요가 없다고 판단해 버립니다 */
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxWidth / longest);

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', quality);
    });

    /* 이미 잘 눌린 작은 그림은 다시 인코딩하면 오히려 커집니다.
       그럴 땐 원본이 정답입니다 */
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toWebpName(file.name), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    /* 디코딩한 픽셀을 바로 놓아줍니다. 20MB 원본이면 메모리에 수백 MB 로 펴집니다 */
    bitmap?.close();
  }
}

function toWebpName(name: string): string {
  return `${name.replace(/\.[^./\\]+$/, '')}.webp`;
}
