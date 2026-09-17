import type { DrawPoolCard, MyPhotocard, PocaGrade } from './nft.types';
import { pocaRole, type PocaRole } from './pocaDraw.model';

/**
 * 도감 한 칸.
 *
 * 🔴 **가진 것과 안 가진 것이 같은 모양**입니다. 안 가진 칸을 빼 버리면 도감이 아니라 그냥
 * 내 카드 목록이고, "뭘 더 모아야 하는지" 를 알 수 없습니다. 그래서 전체 도안을 기준으로
 * 깔고 내가 가진 것을 얹습니다.
 */
export interface PocaDexEntry {
  designId: number;
  name: string;
  imageUrl: string | null;
  group: string | null;
  grade: PocaGrade | null;
  /** 코치·교육생·개발자. 소속 꼬리표가 없는 옛 도안은 null */
  role: PocaRole | null;
  /** 몇 장 가졌는가. 0 이면 아직 없는 칸 */
  count: number;
  /**
   * 대표 카드의 photocardId — 눌렀을 때 열 상세.
   * 안 가진 칸은 null 이라 누를 것이 없습니다.
   */
  photocardId: number | null;
}

/** 역할 필터 — '전체' 는 필터를 걸지 않는다는 뜻이라 별도 값으로 둡니다 */
export const DEX_ROLE_ALL = 'ALL' as const;
export type DexRoleFilter = typeof DEX_ROLE_ALL | PocaRole;

export const DEX_ROLE_OPTIONS: { value: DexRoleFilter; label: string }[] = [
  { value: DEX_ROLE_ALL, label: '전체' },
  { value: '코치', label: '코치' },
  { value: '교육생', label: '교육생' },
  { value: '개발자', label: '개발자' },
];

/**
 * 전체 도안 + 내가 가진 카드 → 도감.
 *
 * 🔴 **도안 ID 로 맞춥니다.** 이름으로 맞추면 운영자가 도안 이름을 바꾸는 순간 보유 표시가
 * 통째로 어긋나고, 이름이 같은 다른 도안이 생기면 남의 칸이 채워집니다.
 *
 * ⚠️ **판매 중인 카드도 가진 것으로 셉니다.** 아직 내 것이고(팔리기 전까지), 도감은 "무엇을
 * 모았나" 를 보는 곳이라 판매 상태로 칸이 비면 오히려 거짓말이 됩니다. 판매 관리는 다른
 * 화면의 몫입니다.
 *
 * 순서는 **서버가 준 도안 순서 그대로**입니다 — 가진 것을 앞으로 당기면 카드를 얻을 때마다
 * 도감의 자리가 바뀌어서, 외워 둔 위치로 찾아가는 도감의 성질이 사라집니다.
 */
export function buildPocaDex(pool: DrawPoolCard[], mine: MyPhotocard[]): PocaDexEntry[] {
  const owned = new Map<number, { count: number; photocardId: number }>();

  for (const card of mine) {
    const found = owned.get(card.designId);
    if (found) found.count += 1;
    else owned.set(card.designId, { count: 1, photocardId: card.photocardId });
  }

  return pool.map((design) => {
    const has = owned.get(design.designId);
    return {
      designId: design.designId,
      name: design.name,
      imageUrl: design.imageUrl,
      group: design.group,
      grade: design.grade,
      /* 🔴 소속이 없으면 역할을 **추측하지 않습니다.** `pocaRole` 은 문자열을 전제로 하고,
         없는 값으로 부르면 터집니다. 옛 도안은 역할 필터에서 빠지는 편이 낫습니다 —
         틀린 칸에 넣는 것보다 안 보이는 쪽이 고치기 쉽습니다. */
      role: design.group ? pocaRole(design.group, design.grade ?? undefined) : null,
      count: has?.count ?? 0,
      photocardId: has?.photocardId ?? null,
    };
  });
}

/**
 * 검색어 + 역할로 거릅니다.
 *
 * ⚠️ **안 가진 칸도 검색에 걸립니다.** 이름으로 찾는 것은 "이 카드를 가졌는지" 를 확인하려는
 * 행동이라, 없는 카드가 빠지면 정작 답을 못 얻습니다.
 */
export function filterPocaDex(
  entries: PocaDexEntry[],
  filter: { keyword?: string; role?: DexRoleFilter },
): PocaDexEntry[] {
  const keyword = filter.keyword?.trim().toLowerCase();
  const role = filter.role ?? DEX_ROLE_ALL;

  return entries.filter((entry) => {
    if (role !== DEX_ROLE_ALL && entry.role !== role) return false;
    if (!keyword) return true;
    /* 이름과 소속 둘 다 봅니다 — "서울 5반" 으로 반 전체를 찾는 쓰임이 자연스럽습니다 */
    return (
      entry.name.toLowerCase().includes(keyword) ||
      (entry.group?.toLowerCase().includes(keyword) ?? false)
    );
  });
}

/** 모은 칸 / 전체 칸 — 머리말에 "12 / 40" 으로 씁니다 */
export function dexProgress(entries: PocaDexEntry[]): { owned: number; total: number } {
  return {
    owned: entries.filter((entry) => entry.count > 0).length,
    total: entries.length,
  };
}
