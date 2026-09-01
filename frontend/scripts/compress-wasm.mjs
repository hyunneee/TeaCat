import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip, constants } from 'node:zlib';

/**
 * 빌드 뒤에 `.wasm` 옆에 `.wasm.gz` 를 만들어 둡니다.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────
 * onnxruntime 런타임은 13MB 입니다. 정적 호스트가 `application/wasm` 을
 * 압축해 주지 않으면 얼굴 등록 첫 진입에 13MB 를 그대로 받습니다.
 * 압축 여부를 **호스트 설정에 맡기지 않고** 우리가 직접 보장합니다.
 *
 * 브라우저 쪽은 `DecompressionStream('gzip')` 으로 풀어서 ORT 에 넘깁니다.
 * (features/face/model/face.worker.ts) `.gz` 가 없으면 원본으로 폴백하므로
 * 개발 서버에서도 그대로 동작합니다.
 *
 * brotli 를 쓰지 않는 이유: 브라우저의 DecompressionStream 이 gzip·deflate 만
 * 지원합니다. 호스트가 brotli 를 켜 주면 더 줄어들지만(2.2MB), 그건 덤입니다.
 */

const DIST = 'dist';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

let count = 0;
for await (const path of walk(DIST)) {
  if (!path.endsWith('.wasm')) continue;

  const gzPath = `${path}.gz`;
  await pipeline(
    createReadStream(path),
    createGzip({ level: constants.Z_BEST_COMPRESSION }),
    createWriteStream(gzPath),
  );

  const raw = await stat(path);
  const gz = await stat(gzPath);
  console.log(`[wasm] ${path}  ${mb(raw.size)} → ${mb(gz.size)}`);
  count += 1;
}

if (count === 0) console.log('[wasm] 압축할 .wasm 이 없습니다.');
