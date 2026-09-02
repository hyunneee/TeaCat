/**
 * 얼굴 파이프라인 **배관 검증** — 사진 없이 확인할 수 있는 것만 확인합니다.
 *
 *   node scripts/verify-face-pipeline.mjs
 *
 * 확인하는 것
 *   1) 두 모델 세션이 생성되는가 (INT8 연산자 지원)
 *   2) 코드가 넣는 입력 shape 를 모델이 받아주는가
 *   3) 출력 텐서 개수·길이가 격자 복원식(6400/1600/400)과 맞는가
 *   4) 5점 정렬(닮음 변환)이 수학적으로 맞는가 — 역변환으로 되돌려 확인
 *   5) 추론 지연 (가이드 루프 fps 가 현실적인지)
 *
 * 확인 못 하는 것: **실제 얼굴 정확도.** 그건 /dev/face 화면에서 사진으로 봅니다.
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as ort from 'onnxruntime-web/wasm';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmBinary = await readFile(
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
);
ort.env.logLevel = 'fatal';

const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => {
  console.log(`  ❌ ${m}`);
  process.exitCode = 1;
};

/* ── 1~3. 모델 배관 ─────────────────────────────────────── */
console.log('\n[1] 검출기 YuNet');
const DET = 640;
const det = await ort.InferenceSession.create(
  await readFile('public/models/face_detection_yunet_2023mar.onnx'),
  { executionProviders: ['wasm'] },
);
ok('세션 생성');

const detInput = new Float32Array(3 * DET * DET);
// 균일 회색 — 얼굴이 없으므로 검출 0건이 정상입니다 (오검출 확인)
detInput.fill(128);
let t0 = Date.now();
const detOut = await det.run({ input: new ort.Tensor('float32', detInput, [1, 3, DET, DET]) });
const detMs = Date.now() - t0;
ok(`추론 OK — ${detMs}ms (${(1000 / detMs).toFixed(1)}fps 상한)`);

const EXPECT = { 8: 6400, 16: 1600, 32: 400 };
for (const [stride, n] of Object.entries(EXPECT)) {
  const cls = detOut[`cls_${stride}`];
  const kps = detOut[`kps_${stride}`];
  if (cls?.data.length === n && kps?.data.length === n * 10) {
    ok(`stride ${stride}: cls ${n}, kps ${n * 10} — 격자 복원식과 일치`);
  } else {
    bad(`stride ${stride}: cls ${cls?.data.length} / kps ${kps?.data.length} (기대 ${n} / ${n * 10})`);
  }
}

// 회색 화면에서 얼굴이 잡히면 점수 임계값이나 디코딩이 잘못된 것입니다.
let maxScore = 0;
for (const stride of [8, 16, 32]) {
  const cls = detOut[`cls_${stride}`].data;
  const obj = detOut[`obj_${stride}`].data;
  for (let i = 0; i < cls.length; i += 1) {
    maxScore = Math.max(maxScore, Math.sqrt(Math.max(0, cls[i] * obj[i])));
  }
}
if (maxScore < 0.6) ok(`균일 회색에서 최고 점수 ${maxScore.toFixed(3)} < 0.6 — 오검출 없음`);
else bad(`균일 회색에서 점수 ${maxScore.toFixed(3)} — 임계값/디코딩 의심`);

console.log('\n[2] 인식기 SFace INT8');
const emb = await ort.InferenceSession.create(
  await readFile('public/models/face_recognition_sface_2021dec_int8.onnx'),
  { executionProviders: ['wasm'] },
);
ok('세션 생성 — INT8 연산자 지원됨');

const EMB = 112;
const embInput = new Float32Array(3 * EMB * EMB);
for (let i = 0; i < embInput.length; i += 1) embInput[i] = (i * 37) % 256; // BGR 0~255
t0 = Date.now();
const embOut = await emb.run({ data: new ort.Tensor('float32', embInput, [1, 3, EMB, EMB]) });
const embMs = Date.now() - t0;
const vector = embOut.fc1.data;
ok(`추론 OK — ${embMs}ms`);

if (vector.length === 128) ok('출력 128차원 (fc1)');
else bad(`출력 ${vector.length}차원 — 코드/목업의 EMBEDDING_DIM 과 불일치`);

let norm = 0;
for (const v of vector) norm += v * v;
norm = Math.sqrt(norm);
if (norm > 1e-3 && Number.isFinite(norm)) ok(`노름 ${norm.toFixed(3)} — 죽은 출력 아님`);
else bad(`노름 ${norm} — 전처리/양자화 문제 의심`);

/* ── 4. 5점 정렬 수학 ───────────────────────────────────── */
console.log('\n[3] 5점 정렬 (닮음 변환)');
const tmp = 'scripts/.embedding.mjs';
execFileSync(
  process.execPath,
  [
    'node_modules/esbuild/bin/esbuild',
    'src/features/face/model/embedding.ts',
    '--format=esm',
    `--outfile=${tmp}`,
    '--log-level=error',
  ],
  { stdio: 'inherit' },
);
const { solveSimilarity, SFACE_TEMPLATE, cosineSimilarity, l2Normalize } = await import(
  `../${tmp}`
);

/* 템플릿을 알려진 각도·배율·이동으로 흐트러뜨린 뒤,
   solveSimilarity 가 원래 자리로 되돌리는지 봅니다. */
const angle = 0.21; // 약 12도
const scale = 2.4;
const [dx, dy] = [130, -45];
const scattered = SFACE_TEMPLATE.map(([x, y]) => [
  scale * (x * Math.cos(angle) - y * Math.sin(angle)) + dx,
  scale * (x * Math.sin(angle) + y * Math.cos(angle)) + dy,
]);

const t = solveSimilarity(scattered, SFACE_TEMPLATE);
let worst = 0;
SFACE_TEMPLATE.forEach(([tx, ty], i) => {
  const [sx, sy] = scattered[i];
  const mx = t.a * sx + t.c * sy + t.e;
  const my = t.b * sx + t.d * sy + t.f;
  worst = Math.max(worst, Math.hypot(mx - tx, my - ty));
});
if (worst < 0.01) ok(`역변환 최대 오차 ${worst.toExponential(2)}px — 정렬 수학 정상`);
else bad(`역변환 최대 오차 ${worst.toFixed(3)}px — 정렬 수학 확인 필요`);

/* 코사인·L2 정규화 자체 검증 */
const a = new Float32Array([3, 4, 0]);
const na = l2Normalize(a);
const unit = Math.hypot(na[0], na[1], na[2]);
if (Math.abs(unit - 1) < 1e-6) ok('L2 정규화 → 단위벡터');
else bad(`L2 정규화 결과 노름 ${unit}`);

const same = cosineSimilarity(new Float32Array([1, 2, 3]), new Float32Array([2, 4, 6]));
const orth = cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]));
if (Math.abs(same - 1) < 1e-6 && Math.abs(orth) < 1e-6) ok('코사인 유사도 (평행 1.0 / 직교 0.0)');
else bad(`코사인 유사도 이상 — 평행 ${same}, 직교 ${orth}`);

await unlink(tmp).catch(() => undefined);

console.log(
  `\n요약: 검출 ${detMs}ms · 임베딩 ${embMs}ms · 임베딩 차원 ${vector.length}` +
    `\n(실제 얼굴 정확도는 /dev/face 에서 사진으로 확인하세요)\n`,
);
