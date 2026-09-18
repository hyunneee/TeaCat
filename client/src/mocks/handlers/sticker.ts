import { mock, mockError } from '../router';
import heart from '../assets/sticker/heart.webp';
import catFace from '../assets/sticker/cat_face.webp';
import smile from '../assets/sticker/smile.webp';
import creature from '../assets/sticker/creature.webp';
import catLying from '../assets/sticker/cat_lying.webp';

/**
 * AI 스티커 목업 — 서버가 생기면 **이 파일만** 지웁니다.
 *
 * 계약은 `features/sticker/model/sticker.types.ts` 가 기준입니다. 여기서 모양을 바꾸지 마세요.
 *
 * 재현하는 것:
 *   - 생성 요청 → 작업 하나. 🔴 **바로 DONE 을 주지 않습니다.** 첫 조회 PENDING, 둘째 RUNNING,
 *     셋째부터 DONE — 대기 화면이 실제로 그려지게. 바로 끝내면 폴링·로딩이 한 번도 안 돌아
 *     나중에 실서버에서 터집니다.
 *   - 결과 이미지는 2026-09-18 fal 로 만든 **진짜 결과물** 5장을 돌려 씁니다(픽셀 아이템 화풍).
 *     가짜 회색 네모로 화면을 만들면 크기·여백 문제를 못 봅니다.
 *   - 일일 상한 5장 (설계 9-1). 넘으면 429 `STICKER_DAILY_LIMIT`.
 *   - 4번째 요청은 한 번 FAILED 로 — 실패 화면도 봐야 합니다.
 *
 * ⚠️ 로그인 검사는 하지 않습니다. `/dev/sticker` 에서 로그인 없이 화면을 만들기 위함이고,
 *    실서버는 당연히 봅니다. 목업 사용자 구분 없이 하나의 몫을 씁니다.
 */

const DAILY_LIMIT = 5;
const RESULTS = [heart, catFace, smile, creature, catLying];

interface MockJob {
  jobId: number;
  polls: number;
  seed: number;
  createdAt: string;
  failOnce: boolean;
  stickerId: number | null;
}

interface MockSticker {
  id: number;
  imageUrl: string;
  createdAt: string;
  deleted: boolean;
}

let jobSeq = 1;
let stickerSeq = 1;
const jobs = new Map<number, MockJob>();
const stickers: MockSticker[] = [];

const usedToday = () => jobs.size;
const quota = () => ({ limit: DAILY_LIMIT, used: usedToday(), remaining: Math.max(0, DAILY_LIMIT - usedToday()) });

mock('GET', '/stickers/quota', () => quota());

mock('POST', '/stickers', (ctx) => {
  const sketch = ctx.body.sketchBase64;
  if (typeof sketch !== 'string' || sketch.length < 100) {
    throw mockError(400, 'STICKER_EMPTY', '낙서가 비어 있습니다.');
  }
  const subject = ctx.body.subject;
  if (typeof subject === 'string' && subject.length > 20) {
    throw mockError(400, 'STICKER_SUBJECT_TOO_LONG', '주제는 20자까지입니다.');
  }
  if (usedToday() >= DAILY_LIMIT) {
    throw mockError(429, 'STICKER_DAILY_LIMIT', '오늘 만들 수 있는 스티커를 다 썼습니다.');
  }
  const jobId = jobSeq++;
  jobs.set(jobId, {
    jobId,
    polls: 0,
    seed: Number(ctx.body.seed ?? 0),
    createdAt: new Date().toISOString(),
    failOnce: jobId === 4, // 네 번째는 실패 화면 확인용
    stickerId: null,
  });
  return { jobId, remainingToday: DAILY_LIMIT - usedToday() };
});

mock('GET', '/stickers/jobs/:jobId', (ctx) => {
  const job = jobs.get(Number(ctx.params.jobId));
  if (!job) throw mockError(404, 'STICKER_JOB_NOT_FOUND', '작업이 없습니다.');
  job.polls += 1;
  if (job.polls === 1) return { jobId: job.jobId, status: 'PENDING' };
  if (job.polls === 2) return { jobId: job.jobId, status: 'RUNNING' };
  if (job.failOnce) return { jobId: job.jobId, status: 'FAILED', failReason: 'WORKER_ERROR' };
  if (job.stickerId === null) {
    const id = stickerSeq++;
    stickers.unshift({
      id,
      imageUrl: RESULTS[(job.jobId + job.seed) % RESULTS.length]!,
      createdAt: new Date().toISOString(),
      deleted: false,
    });
    job.stickerId = id;
  }
  const s = stickers.find((x) => x.id === job.stickerId)!;
  return {
    jobId: job.jobId,
    status: 'DONE',
    sticker: { id: s.id, imageUrl: s.imageUrl, createdAt: s.createdAt },
  };
});

mock('GET', '/users/me/stickers', () =>
  stickers.filter((s) => !s.deleted).map(({ id, imageUrl, createdAt }) => ({ id, imageUrl, createdAt })),
);

mock('DELETE', '/stickers/:stickerId', (ctx) => {
  const s = stickers.find((x) => x.id === Number(ctx.params.stickerId) && !x.deleted);
  if (!s) throw mockError(404, 'STICKER_NOT_FOUND', '스티커가 없습니다.');
  s.deleted = true; // 소프트 삭제 (설계 6-1)
  return null;
});
