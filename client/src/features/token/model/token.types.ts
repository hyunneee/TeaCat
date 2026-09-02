/**
 * 캣머니 잔액.
 *
 * ⚠️ 화면에 보이는 이 숫자는 **표시용**입니다.
 * 결제·구매에서 실제로 얼마가 빠질지는 **서버가 확정**합니다.
 * 프론트가 계산한 값을 결제 요청에 실어 보내면 공짜 티켓이 나옵니다.
 * (CLAUDE.md 7장 · DESIGN.md 12장)
 */
export interface TokenBalance {
  balance: number;
  /** 표기 단위 (지금은 항상 캣머니) */
  symbol: string;
}
