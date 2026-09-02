/**
 * 실제 ONNX 모델의 **입출력 규격을 눈으로 확인**하는 개발용 스크립트.
 *
 *   node scripts/inspect-face-models.mjs
 *
 * 코드가 가정한 텐서 이름·shape 이 맞는지 추측하지 않고 여기서 확정합니다.
 * (세션 생성 자체가 되는지 = INT8 연산자 지원 확인도 여기서 끝납니다)
 */
import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-web/wasm';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmBinary = await readFile(
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
);
ort.env.logLevel = 'error';

const MODELS = [
  ['검출 YuNet', 'public/models/face_detection_yunet_2023mar.onnx'],
  ['인식 SFace INT8', 'public/models/face_recognition_sface_2021dec_int8.onnx'],
];

for (const [label, path] of MODELS) {
  console.log(`\n${'═'.repeat(60)}\n${label}\n  ${path}`);
  try {
    const bytes = await readFile(path);
    const t0 = Date.now();
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
    });
    console.log(`  세션 생성 OK (${Date.now() - t0}ms)`);

    const dump = (kind, names, meta) => {
      console.log(`  ${kind}:`);
      for (const name of names) {
        const m = meta?.find?.((x) => x.name === name);
        console.log(
          `    ${name.padEnd(12)} ${m ? `${m.type} [${(m.shape ?? []).join(', ')}]` : '(메타 없음)'}`,
        );
      }
    };
    dump('입력', session.inputNames, session.inputMetadata);
    dump('출력', session.outputNames, session.outputMetadata);
  } catch (error) {
    console.log(`  ❌ 실패: ${error.message}`);
  }
}
