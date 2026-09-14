/**
 * 카드팩 이벤트 — "지금 계정당 카드팩 하나를 준다" 는 기간 설정입니다.
 *
 * 🔴 진행 중인 이벤트가 **하나도 없으면 팩이 지급되지 않습니다.** 서버는 이걸 에러가 아니라
 * `granted: false` 로 조용히 돌려주므로, 화면에서 "지금 나가는 이벤트" 를 분명히 보여줘야 합니다.
 */
export interface AdminPackEvent {
  id: number;
  /** 지급된 팩의 출처로 남고 **계정당 1회**의 기준. 등록 뒤에는 바꿀 수 없습니다 */
  code: string;
  name: string;
  /** null 이면 즉시 시작 */
  startsAt: string | null;
  /** null 이면 무기한 */
  endsAt: string | null;
  /** 스위치가 켜져 있는가 */
  active: boolean;
  /** 지금 실제로 지급되는가 — 스위치가 켜져 있어도 기간 밖이면 false */
  ongoing: boolean;
  grantedCount: number;
}

export interface AdminPackEventCreateRequest {
  code: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
}
