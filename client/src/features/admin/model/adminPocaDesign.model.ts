import type { AdminPocaDesign } from './adminPocaDesign.types';

/**
 * 도안 이름의 최대 길이 — 서버 `nft_photocard_designs.name` 이 varchar(100) 입니다.
 * 🔴 서버는 **자르지 않고 거절**합니다(NFT_049). 이름은 온체인 메타데이터에 박혀
 * 되돌릴 수 없어서, 조용히 잘린 이름이 영구히 남는 것보다 낫다는 판단입니다.
 */
export const DESIGN_NAME_MAX = 100;

/** 공연 도안 이름을 잇는 구분자. 서버와 같은 값이어야 길이 계산이 맞습니다 */
const JOINER = ' · ';

/**
 * 풀에 넣었을 때 생길 도안 이름의 길이.
 *
 * 공연 풀이면 `"{템플릿 이름} · {공연 제목}"`, 이벤트 풀이면 템플릿 이름 그대로입니다.
 * 화면이 미리 재서 막아야 확인 모달까지 갔다가 튕기지 않습니다.
 */
export function designNameLength(templateName: string, performanceTitle?: string): number {
  if (!performanceTitle) return templateName.length;
  return templateName.length + JOINER.length + performanceTitle.length;
}

/**
 * 지금 뽑힐 수 있는 도안인가.
 *
 * 🔴 온체인 등록이 끝나야(`REGISTERED`) 뽑힙니다. 서버의 `poolRemaining` 은 등록 상태를
 * 보지 않고 잔여를 다 더하므로, 미등록 도안이 섞이면 "충분함" 이 낙관적으로 나옵니다.
 */
export function isDrawable(design: AdminPocaDesign): boolean {
  return design.drawPool && design.chainStatus === 'REGISTERED' && design.remaining > 0;
}

/** 아직 뽑히지 못하는 도안 — 화면이 따로 표시해 줘야 합니다 */
export function notYetDrawable(designs: AdminPocaDesign[]): AdminPocaDesign[] {
  return designs.filter((d) => d.chainStatus !== 'REGISTERED');
}
