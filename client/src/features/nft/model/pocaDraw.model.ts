import { pocaName } from './nft.model';
import type { PocaDrawResult, PocaGrade } from './nft.types';

/**
 * 포카 개봉 — 순수 규칙만. React 를 모릅니다.
 *
 * 봉지를 자르는 좌표 계산과 등급별 문구가 여기 있습니다.
 * 화면(components)은 여기서 나온 값을 그리기만 합니다.
 */

/* ── 봉지 좌표계 ────────────────────────────────────────────
   pack.webp 실측: 파일 2304×3456 안에서 실제 봉지는 (238,141)~(2052,3325).
   주변 10% 가 투명 여백이라 그대로 쓰면 자르는 선이 어긋납니다.
   그래서 '봉지만' 의 크기를 좌표계로 삼고, 이미지를 확대·이동해 맞춥니다.
   비율이므로 이미지를 더 작은 webp 로 바꿔도 이 값들은 그대로입니다. */
export const PACK = {
  /** 봉지 자체의 가로세로 (표시 px). `.app-width` 336px 안에 여백을 두고 들어갑니다 */
  width: 279.8,
  height: 491,
  /** 배율 = 491 / 3185 = 0.15417. 이만큼 키워서 이만큼 밀어야 봉지가 딱 맞습니다 */
  imageWidth: 355.2,
  imageHeight: 532.8,
  imageLeft: -36.7,
  imageTop: -21.7,
  /** 절취선 — 검은 실링 바로 아래 */
  cutY: 66,
} as const;

/** 자르는 중 손가락이 지나간 점 하나 */
export interface CutPoint {
  x: number;
  y: number;
}

/**
 * 손가락 위치(화면 px) → 봉지 좌표계 x.
 * 봉지가 부유 애니메이션으로 흔들려도 가로 위치는 영향이 없습니다.
 */
export function toPackX(clientX: number, packLeft: number, packWidth: number): number {
  const x = ((clientX - packLeft) / packWidth) * PACK.width;
  return Math.max(0, Math.min(PACK.width, x));
}

/**
 * 다음 점을 받을지 판단합니다.
 * - 너무 촘촘하면 건너뜁니다 (점이 수백 개가 되면 polygon 이 길어집니다)
 * - 되돌아가는 건 무시합니다 (한 번 자른 곳은 다시 붙지 않습니다)
 */
export function shouldAddPoint(points: CutPoint[], x: number): boolean {
  const last = points[points.length - 1];
  if (!last) return true;
  return x - last.x >= 7;
}

/** 종이가 매끈하게 안 잘리는 느낌 — y 를 조금씩 흔듭니다 */
export function cutPointAt(x: number, jitter: number): CutPoint {
  return { x, y: PACK.cutY + (jitter - 0.5) * 5 };
}

/**
 * 자르기를 시작할 수 있는 위치인가 — **왼쪽 끝에서만** 시작합니다.
 * 아무 데서나 시작하게 두면 오른쪽 끝을 한 번 탭하는 것만으로 다 잘립니다.
 */
export function canStartCut(x: number): boolean {
  return x <= PACK.width * 0.3;
}

/**
 * 끝까지 잘렸는가.
 *
 * 🔴 마지막 점만 보면 안 됩니다. 오른쪽 끝을 한 번 탭해도 조건이 참이 되어
 * **밀지 않고 열리는** 버그가 됩니다. 왼쪽에서 시작해 오른쪽까지 **지나온 것**을 봅니다.
 */
export function isCutThrough(points: CutPoint[]): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 4) return false;
  return first.x <= PACK.width * 0.3 && last.x >= PACK.width - 8;
}

/** 점들을 SVG path 로 (자른 자국을 그릴 때) */
export function toSvgPath(points: CutPoint[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * 자른 경로를 위/아래 두 조각의 `clip-path` 로 바꿉니다.
 *
 * 같은 이미지를 두 번 겹쳐 놓고 서로 반대쪽만 남기면, 단면이 픽셀 단위로 맞물립니다.
 * 조각난 이미지를 미리 만들어 둘 필요가 없습니다.
 */
export function toClipPaths(points: CutPoint[]): { top: string; bottom: string } {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return {
      top: 'polygon(0 0, 100% 0, 100% 0, 0 0)',
      bottom: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
    };
  }

  /* 양 끝을 봉지 가장자리까지 늘려 확실히 관통시킵니다 */
  const full: CutPoint[] = [{ x: 0, y: first.y }, ...points, { x: PACK.width, y: last.y }];
  const pct = (p: CutPoint) =>
    `${((p.x / PACK.width) * 100).toFixed(2)}% ${((p.y / PACK.height) * 100).toFixed(2)}%`;

  return {
    top: `polygon(0% 0%, 100% 0%, ${[...full].reverse().map(pct).join(', ')})`,
    bottom: `polygon(${full.map(pct).join(', ')}, 100% 100%, 0% 100%)`,
  };
}

/* ── 등급 ───────────────────────────────────────────────────── */

export function isSpecial(grade: PocaGrade): boolean {
  return grade === 'SPECIAL';
}

/* ── 호칭 ───────────────────────────────────────────────────── */

/** 카드 주인공이 누구인가. 호칭과 연출을 함께 정합니다 */
export type PocaRole = '코치' | '교육생' | '개발자';

export const POCA_ROLES: PocaRole[] = ['코치', '교육생', '개발자'];

/** 소속 뒤에 역할을 적어 넣을 때 쓰는 구분자 */
const ROLE_MARK = ' · ';

/**
 * 소속에 역할을 적어 넣습니다 — `("서울 5반", "코치") → "서울 5반 · 코치"`.
 * 어드민이 카드 그림을 등록할 때 씁니다.
 */
export function withPocaRole(group: string, role: PocaRole): string {
  return `${group.trim()}${ROLE_MARK}${role}`;
}

/**
 * 이 카드 주인공이 누구인지.
 *
 * 🔴 **적혀 있으면 그대로 읽고 추측하지 않습니다.** 예전에는 소속이 '서울' 로 시작하는지
 * 보고 코치를 골랐는데, 교육생도 '서울 5반' 소속이라 **사실대로 적으면 코치가 되는**
 * 규칙이었습니다. 지금은 어드민이 역할을 직접 고릅니다.
 *
 * 표시가 없는 예전 카드만 옛 규칙으로 읽습니다 — 이미 뿌린 카드의 호칭이 오늘 바뀌면 안 됩니다.
 */
export function pocaRole(group: string, grade?: PocaGrade): PocaRole {
  const tail = group.split(ROLE_MARK).pop()?.trim();
  if (tail === '코치' || tail === '교육생' || tail === '개발자') return tail;

  if (group.startsWith('서울')) return '코치';
  return grade && !isSpecial(grade) ? '개발자' : '교육생';
}

/** 결과 문구를 네 토막으로 — 크기·색·움직임이 저마다 다릅니다 */
export interface DrawLine {
  /** 윗줄 앞에 작게 붙는 감탄사. "으악..." (코치·교육생에는 없습니다) */
  prefix: string;
  /** 윗줄 큰 글씨. 글자마다 움직입니다. "김예린 코치님" */
  lead: string;
  /** 윗줄 끝에 작게 붙는 조사. "을" (개발자 카드에는 없습니다) */
  josa: string;
  /** 아랫줄. "뽑았어요!" */
  tail: string;
}

/**
 * 카드 위에 뜨는 결과 문구.
 * 호칭이 바뀌거나 등급이 늘면 여기만 고칩니다 — 화면은 이 값을 그리기만 합니다.
 */
export function drawLine(result: PocaDrawResult): DrawLine {
  return drawLineOf(result.designName, result.group, result.grade);
}

/** 뽑기 결과가 아직 없어도(어드민 미리보기) 같은 문구를 만들 수 있게 */
export function drawLineOf(fullName: string, group: string, grade: PocaGrade): DrawLine {
  const designName = pocaName(fullName);

  /* 코치·교육생이 같이 쓰는 뒷말 */
  const picked = { prefix: '', josa: '을', tail: '뽑았어요!' };

  switch (pocaRole(group, grade)) {
    case '코치':
      return { ...picked, lead: `${designName} 코치님` };
    case '교육생':
      return { ...picked, lead: `${designName} 교육생` };
    default:
      return { prefix: '으악...', lead: `${designName} 개발자`, josa: '', tail: '카드네요...' };
  }
}

/**
 * 크게 보기의 이름 줄 — "박유신 코치님" · "정재원 교육생" · "최재성 개발자".
 *
 * 소속을 모르면(서버가 아직 안 줍니다) **이름만** 돌려줍니다 — 호칭을 추측하면
 * 코치를 교육생이라 부르는 일이 생깁니다.
 */
export function pocaTitle(fullName: string, group?: string, grade?: PocaGrade): string {
  const designName = pocaName(fullName);
  if (!group) return designName;

  const role = pocaRole(group, grade);
  return role === '코치' ? `${designName} 코치님` : `${designName} ${role}`;
}

/** 같은 문구를 한 줄로 (읽어 주는 기기용 · 목록 표시용) */
export function drawMessage(result: PocaDrawResult): string {
  return drawMessageOf(result.designName, result.group, result.grade);
}

/** 어드민 미리보기용 — 등록하기 전에 무슨 말이 나올지 그대로 보여줍니다 */
export function drawMessageOf(designName: string, group: string, grade: PocaGrade): string {
  const { prefix, lead, josa, tail } = drawLineOf(designName, group, grade);
  return `${prefix ? `${prefix} ` : ''}${lead}${josa} ${tail}`;
}
