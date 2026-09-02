import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * 얼굴 인식 ONNX 모델을 `public/models/` 에 준비합니다. (빌드 맨 앞에서 실행)
 *
 * ── 왜 필요한가 ───────────────────────────────────────────
 * 모델은 용량 때문에 저장소에 커밋하지 않습니다(`.gitignore`).
 * 그래서 **저장소를 클론해서 빌드하는 배포 파이프라인에는 모델이 없습니다.**
 * 그 상태로 배포하면 브라우저가 `/models/....onnx` 를 받으려다
 * SPA 폴백(index.html)을 받아 오고, onnxruntime 이 HTML 을 protobuf 로 읽으려다
 *
 *     Can't create a session. ERROR_CODE: 7,
 *     ERROR_MESSAGE: Failed to load model because protobuf parsing failed.
 *
 * 로 죽습니다. 로컬에서는 파일이 있으니 재현되지 않아 찾기 어렵습니다.
 *
 * ── 무엇을 하는가 ─────────────────────────────────────────
 *   1. 파일이 이미 있으면 아무것도 하지 않습니다 (해시만 확인).
 *   2. 없으면 OpenCV Zoo 에서 받아 **sha256 을 검증한 뒤** 저장합니다.
 *   3. 받지 못하면 **빌드를 세웁니다.** 모델 없는 번들을 배포하는 것보다
 *      빌드가 실패하는 게 낫습니다 — 배포된 뒤에는 알 방법이 없습니다.
 *
 * 🔴 해시를 반드시 검증합니다. 임베딩은 **모델이 같아야만** 대조됩니다.
 *    업스트림이 모델을 조용히 갱신하면 등록해 둔 임베딩과 게이트의 검표가
 *    어긋나므로, 다르면 받지 않고 멈춥니다. (모델을 바꿀 때는 아래 표와
 *    `VITE_FACE_MODEL_VERSION` 을 함께 올리세요)
 *
 * ── 건너뛰기 ──────────────────────────────────────────────
 *   SKIP_FACE_MODELS=1        얼굴 등록 없이 빌드만 확인할 때
 *   VITE_FACE_*_URL=https://  CDN 에 올려 두었으면 자동으로 건너뜁니다
 */

/**
 * OpenCV Zoo 의 .onnx 는 **Git LFS** 로 관리됩니다.
 * `raw.githubusercontent.com` 은 131바이트짜리 LFS 포인터 텍스트를 주므로
 * 실제 바이트가 오는 `media.githubusercontent.com/media/...` 를 씁니다.
 * (포인터의 oid 가 아래 sha256 과 같은 것을 확인했습니다)
 */
const REPO = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models';

const MODELS = [
  {
    env: 'VITE_FACE_DETECTOR_URL',
    file: 'face_detection_yunet_2023mar.onnx',
    url: `${REPO}/face_detection_yunet/face_detection_yunet_2023mar.onnx`,
    bytes: 232589,
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
  },
  {
    env: 'VITE_FACE_EMBEDDER_URL',
    file: 'face_recognition_sface_2021dec_int8.onnx',
    url: `${REPO}/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx`,
    bytes: 9896933,
    sha256: '2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a',
  },
];

const PUBLIC_DIR = 'public';
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** .env.production 에서 값 하나 읽기 (dotenv 없이 — 빌드 의존성을 늘리지 않습니다) */
async function envValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.production', '.env']) {
    try {
      const text = await readFile(file, 'utf8');
      const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
      if (line) return line.slice(line.indexOf('=') + 1).trim();
    } catch {
      /* 없으면 다음 파일 */
    }
  }
  return null;
}

/** 앱이 실제로 받아 갈 경로 → 빌드가 파일을 놓아야 하는 위치 */
function targetPath(url, fallbackFile) {
  const pathname = url?.startsWith('/') ? url : `/models/${fallbackFile}`;
  return join(PUBLIC_DIR, ...pathname.split('/').filter(Boolean));
}

async function download(model) {
  process.stdout.write(`[models] ${model.file} 내려받는 중 (${mb(model.bytes)})… `);

  const response = await fetch(model.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const buffer = Buffer.from(await response.arrayBuffer());

  /* ONNX(protobuf)는 0x08(ir_version 필드)로 시작합니다.
     LFS 포인터나 HTML 오류 페이지를 받아 왔으면 여기서 걸립니다. */
  if (buffer[0] !== 0x08) {
    throw new Error(
      `ONNX 파일이 아닙니다 (앞 바이트 0x${buffer[0]?.toString(16)}, ${buffer.length}바이트). ` +
        `LFS 포인터나 오류 페이지를 받은 것 같습니다.`,
    );
  }

  const digest = sha(buffer);
  if (digest !== model.sha256) {
    throw new Error(
      `sha256 이 다릅니다.\n  기대: ${model.sha256}\n  받음: ${digest}\n` +
        `  업스트림 모델이 바뀌었을 수 있습니다. 확인 후 이 스크립트의 해시와 ` +
        `VITE_FACE_MODEL_VERSION 을 함께 갱신하세요.`,
    );
  }

  return buffer;
}

let ready = 0;
const problems = [];

for (const model of MODELS) {
  const url = await envValue(model.env);

  if (url && /^https?:\/\//i.test(url)) {
    console.log(`[models] ${model.file} — 외부 주소를 씁니다 (${url}). 건너뜁니다.`);
    ready += 1;
    continue;
  }

  const path = targetPath(url, model.file);

  const existing = await stat(path).catch(() => null);
  if (existing?.isFile()) {
    const digest = sha(await readFile(path));
    if (digest === model.sha256) {
      console.log(`[models] ${model.file} 준비됨 (${mb(existing.size)})`);
    } else {
      // 일부러 다른 모델을 넣어 둔 경우도 있으니 막지는 않습니다.
      console.log(
        `[models] ⚠️ ${model.file} 이 있지만 해시가 다릅니다 (직접 넣은 모델인가요?). ` +
          `그대로 씁니다.`,
      );
    }
    ready += 1;
    continue;
  }

  if (process.env.SKIP_FACE_MODELS === '1') {
    problems.push(`${model.file} 없음 (SKIP_FACE_MODELS=1 로 건너뜀)`);
    continue;
  }

  try {
    const buffer = await download(model);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    console.log(`받음 → ${path}`);
    ready += 1;
  } catch (error) {
    process.stdout.write('실패\n');
    problems.push(`${model.file}: ${error.message}`);
  }
}

if (problems.length === 0) {
  console.log(`[models] 얼굴 인식 모델 ${ready}/${MODELS.length} 준비 완료.`);
  process.exit(0);
}

const skipping = process.env.SKIP_FACE_MODELS === '1';

console.error(
  [
    '',
    '════════════════════════════════════════════════════════════',
    ' 얼굴 인식 모델을 준비하지 못했습니다.',
    '',
    ...problems.map((p) => ` · ${p}`),
    '',
    ' 이대로 배포하면 카메라 화면에서 이 오류가 납니다:',
    '   Failed to load model because protobuf parsing failed.',
    '   (모델 대신 SPA 폴백 index.html 을 받기 때문입니다)',
    '',
    ' 해결 방법 셋 중 하나를 고르세요.',
    '   1. 네트워크를 확인하고 다시 빌드 (이 스크립트가 자동으로 받습니다)',
    '   2. 모델을 CDN·오브젝트 스토리지에 올리고 .env.production 에',
    '      VITE_FACE_DETECTOR_URL / VITE_FACE_EMBEDDER_URL 을 절대 주소로 지정',
    '   3. public/models/*.onnx 를 저장소에 커밋 (.gitignore 에서 제외)',
    '',
    ' 얼굴 등록을 뺀 채 빌드만 확인하려면 SKIP_FACE_MODELS=1 을 주세요.',
    '════════════════════════════════════════════════════════════',
    '',
  ].join('\n'),
);

process.exit(skipping ? 0 : 1);
