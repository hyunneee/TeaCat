/**
 * 게이트 입장 확인 타입.
 *
 * 🔴 **임베딩은 여기 없습니다.** 티켓에 베껴 둔 얼굴은 서버 밖으로 나오지 않습니다 —
 * 검표기는 지금 찍은 임베딩을 올리고 **판정만** 받습니다. (client/CLAUDE.md 7장)
 */

/** QR 을 찍은 직후 보는 티켓 정보 */
export interface CheckInTicket {
  ticketId: number;
  holderNickname: string;
  title: string;
  performanceNum: number;
  performanceDate: string;
  areaCode: string;
  rowLabel: string | null;
  seatNumber: number | null;
  /** 이미 입장했으면 그 시각. 아직이면 null */
  checkedInAt: string | null;
  /**
   * 얼굴 대조가 가능한가.
   *
   * false 면 예매 당시 얼굴이 없습니다 — 가입할 때 채워 둔 기본 얼굴이거나
   * 탈퇴로 파기된 경우입니다. 이 표는 얼굴로 본인 확인을 할 수 없습니다.
   */
  faceVerifiable: boolean;
}

export interface CheckInResult {
  match: boolean;
  /** 코사인 유사도. 임계값을 맞춰보는 동안만 내려옵니다 */
  similarity: number;
  threshold: number;
  /** 통과했을 때의 입장 시각. 떨어졌으면 null */
  checkedInAt: string | null;
  ticket: CheckInTicket;
}

/** QR 로 찍었는지, 번호를 손으로 넣었는지 */
export type CheckInSource = { qrToken: string } | { ticketId: number };
