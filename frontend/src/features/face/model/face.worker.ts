/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import { SFACE_TEMPLATE, l2Normalize, laplacianVariance, solveSimilarity } from './embedding';
import {
  DETECTOR_INPUT_SIZE,
  decodeYunet,
  detectorOutputNames,
  toFramePixels,
  toNormalized,
  type RawFace,
} from './yunet';
import type { DetectedFace } from './face.types';
import type { FaceWorkerRequest, FaceWorkerResponse } from './faceWorkerProtocol';

/**
 * 얼굴 추론 전담 워커.
 *
 * ── 왜 워커인가 ───────────────────────────────────────────
 * 임베딩 한 번이 수백 ms 걸립니다. 메인 스레드에서 돌리면 그동안 화면이
 * 통째로 멈춥니다 — 카메라 미리보기도 같이 얼어붙어 "앱이 죽었나?" 로 읽힙니다.
 *
 * ── 이 파일이 지키는 것 ───────────────────────────────────
 * 🔴 프레임(ImageBitmap)은 여기서 끝납니다. 밖으로 나가는 건 좌표와 임베딩뿐입니다.
 * 🔴 쓰고 난 프레임은 close(), 캔버스는 clearRect 로 즉시 지웁니다.
 * 🔴 임베딩 값을 로그로 찍지 않습니다.
 */

const EMBED_INPUT_SIZE = 112;
const MODEL_CACHE = 'tikat-face-models-v1';

/* 스레드를 쓰지 않습니다.
   멀티스레드 wasm 은 COOP/COEP 헤더가 필요한데 우리 배포에는 없고,
   1:1 대조는 캡처 시점에 한 번만 돌리므로 단일 스레드로 충분합니다. */
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
/* ORT 가 콘솔에 텐서 정보를 흘리지 않게 (생체정보 규칙) */
ort.env.logLevel = 'error';

let detector: ort.InferenceSession | null = null;
let embedder: ort.InferenceSession | null = null;

/** 워커 안에서만 쓰는 작업용 캔버스. 매번 새로 만들면 GC 압박이 큽니다. */
const detectCanvas = new OffscreenCanvas(DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE);
const detectCtx = detectCanvas.getContext('2d', { willReadFrequently: true })!;
const alignCanvas = new OffscreenCanvas(EMBED_INPUT_SIZE, EMBED_INPUT_SIZE);
const alignCtx = alignCanvas.getContext('2d', { willReadFrequently: true })!;

function reply(message: FaceWorkerResponse, transfer: Transferable[] = []) {
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);
}

/**
 * 모델을 받아 옵니다. **Cache API 에 넣어 두고 다음 방문에는 네트워크를 타지 않습니다.**
 * (서비스워커 precache 에 넣지 않는 이유는 CLAUDE.md 7장 성능 규칙 참고)
 */
async function loadModel(url: string): Promise<{ buffer: ArrayBuffer; cached: boolean }> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(MODEL_CACHE);
  } catch {
    /* 프라이빗 모드 등에서 막힐 수 있습니다. 캐시는 최적화일 뿐이라 없어도 동작합니다. */
  }

  const hit = await cache?.match(url);
  if (hit) {
    const buffer = await hit.arrayBuffer();
    /* 예전 배포에서 **엉뚱한 응답이 캐시에 들어가 있을 수** 있습니다.
       그러면 서버를 고쳐도 이 브라우저만 계속 실패합니다 — 지우고 다시 받습니다. */
    if (looksLikeOnnx(buffer)) return { buffer, cached: true };
    await cache?.delete(url).catch(() => undefined);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`모델을 불러오지 못했습니다 (${response.status}) — ${url}`);
  }

  const buffer = await response.arrayBuffer();
  /* 🔴 **200 이라고 모델인 건 아닙니다.**
     모델이 배포에 빠져 있으면 SPA 폴백이 index.html 을 200 으로 돌려주고,
     onnxruntime 은 그 HTML 을 protobuf 로 읽으려다
       "ERROR_CODE: 7 ... protobuf parsing failed"
     로 죽습니다. 그 메시지로는 원인을 알 수 없으니 여기서 먼저 걸러
     무엇이 잘못됐는지 말해 줍니다. */
  assertOnnx(buffer, url, response.headers.get('content-type'));

  // put 은 body 를 소비하므로 복제해서 넣습니다. **검증을 통과한 것만** 캐시합니다.
  await cache?.put(url, new Response(buffer.slice(0))).catch(() => undefined);
  return { buffer, cached: false };
}

/**
 * ONNX 는 protobuf 이고 첫 필드가 `ir_version`(field 1, varint)이라
 * 파일이 언제나 **0x08** 로 시작합니다. (실측: YuNet·SFace 둘 다 08 06 12…)
 */
function looksLikeOnnx(buffer: ArrayBuffer): boolean {
  return buffer.byteLength > 1024 && new Uint8Array(buffer, 0, 1)[0] === 0x08;
}

function assertOnnx(buffer: ArrayBuffer, url: string, contentType: string | null) {
  if (looksLikeOnnx(buffer)) return;

  const head = new Uint8Array(buffer, 0, Math.min(1, buffer.byteLength))[0];
  const html = contentType?.includes('text/html') || head === 0x3c; // '<'

  throw new Error(
    html
      ? `얼굴 인식 모델을 찾지 못했습니다. 서버가 모델 대신 페이지(HTML)를 돌려줬어요. ` +
        `배포에 모델 파일이 포함됐는지 확인해 주세요 — ${url}`
      : `모델 파일이 손상됐습니다 (${buffer.byteLength}바이트) — ${url}`,
  );
}

/** 기대한 출력이 없으면 조용히 이상한 좌표를 내는 대신 여기서 터뜨립니다. */
function assertDetector(session: ort.InferenceSession) {
  const missing = detectorOutputNames().filter((name) => !session.outputNames.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `검출 모델 규격이 다릅니다. 없는 출력: ${missing.join(', ')} / 실제: ${session.outputNames.join(', ')}`,
    );
  }
}

/**
 * ORT 런타임(13MB)을 **gzip 본으로** 받아 브라우저에서 풀어 넘깁니다.
 *
 * 정적 호스트가 `application/wasm` 을 압축해 주는지 여부에 기대지 않기 위해서입니다.
 * `.wasm.gz` 는 빌드 뒤 scripts/compress-wasm.mjs 가 만들어 둡니다.
 * 없으면(개발 서버) null 을 돌려주고 원본 URL 로 폴백합니다.
 */
async function loadWasmBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(MODEL_CACHE).catch(() => null);
    const gzUrl = `${url}.gz`;

    const hit = await cache?.match(gzUrl);
    const response = hit ?? (await fetch(gzUrl));
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 4));

    /* 서버가 `.gz` 를 보고 Content-Encoding: gzip 을 붙이면 **브라우저가 이미 풀어서** 줍니다.
       그럼 여기 도착한 건 wasm 그 자체입니다. 안 붙이면 gzip 바이트가 그대로 옵니다.
       어느 쪽이든 **회선을 지나간 양은 압축본 크기**로 같습니다 — 앞 4바이트로 구분합니다. */
    const isWasm = head[0] === 0x00 && head[1] === 0x61 && head[2] === 0x73 && head[3] === 0x6d;
    const isGzip = head[0] === 0x1f && head[1] === 0x8b;

    /* `.gz` 가 없는 호스트는 SPA 폴백으로 **index.html 을 200 으로** 줍니다.
       그걸 캐시에 넣어두면 다음 방문에도 같은 쓰레기를 읽습니다 —
       둘 중 하나로 확인된 것만 캐시합니다. */
    if (!hit && (isWasm || isGzip)) {
      await cache?.put(gzUrl, new Response(buffer.slice(0))).catch(() => undefined);
    }

    if (isWasm) return buffer;
    if (!isGzip || typeof DecompressionStream !== 'function') return null;

    return await new Response(
      new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();
  } catch {
    // 개발 서버에는 .gz 가 없습니다. 원본 URL 로 폴백합니다.
    return null;
  }
}

async function init(wasmUrl: string, detectorUrl: string, embedderUrl: string) {
  // 필요한 wasm 하나만 명시합니다. 안 하면 ORT 가 빌드별 파일을 찾아다닙니다.
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };

  // 셋을 동시에 받습니다 — 줄 세우면 느린 회선에서 그만큼 더 기다립니다.
  const [binary, det, emb] = await Promise.all([
    loadWasmBinary(wasmUrl),
    loadModel(detectorUrl),
    loadModel(embedderUrl),
  ]);
  if (binary) ort.env.wasm.wasmBinary = binary;

  /* logSeverityLevel 3 = error 이상만.
     SFace 는 export 할 때 BatchNorm 파라미터가 graph input 으로 남아서,
     기본 설정이면 세션 생성마다 경고 수십 줄이 콘솔에 쏟아집니다.
     동작에는 문제가 없지만 진짜 오류가 묻히므로 잠급니다.
     (ort.env.logLevel 은 JS 쪽 설정이라 네이티브 경고를 막지 못합니다) */
  const options: ort.InferenceSession.SessionOptions = {
    executionProviders: ['wasm'],
    logSeverityLevel: 3,
  };

  detector = await ort.InferenceSession.create(det.buffer, options);
  embedder = await ort.InferenceSession.create(emb.buffer, options);
  assertDetector(detector);

  reply({
    type: 'ready',
    cached: det.cached && emb.cached,
    bytes: det.buffer.byteLength + emb.buffer.byteLength,
  });
}

/** 종횡비를 지킨 채 정사각 입력에 맞춰 넣기 (레터박스) */
function fitFrame(frame: ImageBitmap) {
  const scale = Math.min(
    DETECTOR_INPUT_SIZE / frame.width,
    DETECTOR_INPUT_SIZE / frame.height,
  );
  const width = frame.width * scale;
  const height = frame.height * scale;
  const padX = (DETECTOR_INPUT_SIZE - width) / 2;
  const padY = (DETECTOR_INPUT_SIZE - height) / 2;

  detectCtx.clearRect(0, 0, DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE);
  detectCtx.drawImage(frame, padX, padY, width, height);

  return { scale, padX, padY, frameWidth: frame.width, frameHeight: frame.height };
}

async function detectFaces(frame: ImageBitmap) {
  if (!detector) throw new Error('검출 모델이 준비되지 않았습니다.');

  const fit = fitFrame(frame);
  const { data } = detectCtx.getImageData(0, 0, DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE);

  // [1, 3, H, W] · BGR · 0~255 (YuNet 규격)
  const pixels = DETECTOR_INPUT_SIZE * DETECTOR_INPUT_SIZE;
  const input = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    input[i] = data[i * 4 + 2]!; // B
    input[pixels + i] = data[i * 4 + 1]!; // G
    input[2 * pixels + i] = data[i * 4]!; // R
  }

  const tensor = new ort.Tensor('float32', input, [1, 3, DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE]);
  const outputs = await detector.run({ [detector.inputNames[0]!]: tensor });

  const raw = decodeYunet(outputs as never, DETECTOR_INPUT_SIZE);
  return { raw, fit, faces: raw.map((face) => toNormalized(face, fit)) };
}

/**
 * 5점을 ArcFace 기준 위치로 옮겨 112×112 로 잘라냅니다.
 * canvas 의 setTransform 이 워프를 대신해 줘서 픽셀 루프가 필요 없습니다.
 */
function alignFace(frame: ImageBitmap, landmarksPx: readonly (readonly [number, number])[]) {
  const t = solveSimilarity(landmarksPx, SFACE_TEMPLATE);

  alignCtx.setTransform(1, 0, 0, 1, 0, 0);
  alignCtx.clearRect(0, 0, EMBED_INPUT_SIZE, EMBED_INPUT_SIZE);
  alignCtx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
  alignCtx.drawImage(frame, 0, 0);
  alignCtx.setTransform(1, 0, 0, 1, 0, 0);

  return alignCtx.getImageData(0, 0, EMBED_INPUT_SIZE, EMBED_INPUT_SIZE);
}

async function embedFace(frame: ImageBitmap, face: RawFace, fit: ReturnType<typeof fitFrame>) {
  if (!embedder) throw new Error('인식 모델이 준비되지 않았습니다.');

  const image = alignFace(frame, toFramePixels(face, fit));
  const pixels = EMBED_INPUT_SIZE * EMBED_INPUT_SIZE;

  // 품질 지표는 **정렬된 얼굴**에서 잽니다 (배경이 섞이면 값이 흔들립니다)
  const gray = new Float32Array(pixels);
  let bright = 0;
  for (let i = 0; i < pixels; i += 1) {
    const r = image.data[i * 4]!;
    const g = image.data[i * 4 + 1]!;
    const b = image.data[i * 4 + 2]!;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = luma;
    bright += luma;
  }

  /* SFace 입력: [1, 3, 112, 112] · **BGR · 0~255 · 정규화 없음**
   *
   * 🔴 (x−127.5)/128 을 쓰지 마세요. 그건 MobileFaceNet 계열 관례이고
   *    SFace 는 다릅니다. OpenCV 의 FaceRecognizerSF::feature() 는
   *      Mat blob = dnn::blobFromImage(aligned_img);
   *    를 **기본 인자**로 부릅니다 — scalefactor=1.0, mean=(0,0,0), swapRB=false.
   *    OpenCV 이미지가 BGR 이므로 결과 blob 도 BGR 0~255 입니다.
   *    잘못 넣으면 세션은 잘 돌아가고 **유사도만 조용히 무너집니다.** */
  const input = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    input[i] = image.data[i * 4 + 2]!; // B
    input[pixels + i] = image.data[i * 4 + 1]!; // G
    input[2 * pixels + i] = image.data[i * 4]!; // R
  }

  const tensor = new ort.Tensor('float32', input, [1, 3, EMBED_INPUT_SIZE, EMBED_INPUT_SIZE]);
  const outputs = await embedder.run({ [embedder.inputNames[0]!]: tensor });
  const raw = outputs[embedder.outputNames[0]!]?.data as Float32Array | undefined;
  if (!raw) throw new Error('임베딩을 얻지 못했습니다.');

  // 원본 픽셀을 여기서 버립니다. 아래로 내려가는 건 숫자 벡터뿐입니다.
  alignCtx.clearRect(0, 0, EMBED_INPUT_SIZE, EMBED_INPUT_SIZE);

  return {
    embedding: l2Normalize(new Float32Array(raw)),
    sharpness: laplacianVariance(gray, EMBED_INPUT_SIZE, EMBED_INPUT_SIZE),
    brightness: bright / pixels,
  };
}

/** 프레임을 확실히 놓아줍니다 — 안 하면 GPU 메모리가 계속 쌓입니다 */
function release(frame: ImageBitmap) {
  frame.close();
  detectCtx.clearRect(0, 0, DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE);
}

self.onmessage = async (event: MessageEvent<FaceWorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === 'init') {
      await init(message.wasmUrl, message.detectorUrl, message.embedderUrl);
      return;
    }

    if (message.type === 'detect') {
      try {
        const { faces } = await detectFaces(message.frame);
        reply({ type: 'detected', id: message.id, faces });
      } finally {
        release(message.frame);
      }
      return;
    }

    if (message.type === 'embed') {
      try {
        const { raw, fit, faces } = await detectFaces(message.frame);

        // 얼굴이 정확히 하나일 때만 무거운 모델을 돌립니다.
        // 여러 개면 어느 얼굴을 등록할지 정할 수 없고, 없으면 돌릴 게 없습니다.
        if (raw.length !== 1) {
          reply({
            type: 'embedded',
            id: message.id,
            faces,
            embedding: null,
            sharpness: 0,
            brightness: 0,
          });
          return;
        }

        const result = await embedFace(message.frame, raw[0]!, fit);
        reply(
          {
            type: 'embedded',
            id: message.id,
            faces,
            embedding: result.embedding,
            sharpness: result.sharpness,
            brightness: result.brightness,
          },
          [result.embedding.buffer],
        );
      } finally {
        release(message.frame);
      }
    }
  } catch (error) {
    reply({
      type: 'failed',
      id: 'id' in message ? message.id : undefined,
      message: error instanceof Error ? error.message : '얼굴 인식에 실패했습니다.',
    });
  }
};

export type { DetectedFace };
