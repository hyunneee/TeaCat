/** 서버 `BalanceResponse` 그대로입니다. 회원 본인이 보는 값과 같은 계산입니다. */
export interface AdminCatMoneyBalance {
  /** 체인 잔액. 묶인 돈도 미확정 소각도 빼지 않은 원시값입니다 */
  balance: number;
  /** 지금 쓸 수 없는 금액 (입찰로 묶인 돈 + 확정을 기다리는 소각) */
  held: number;
  /**
   * 지금 쓸 수 있는 금액 (balance − held).
   *
   * 🔴 화면의 "잔액" 자리에 넣는 값이고, **차감의 상한**이기도 합니다.
   */
  available: number;
  symbol: string;
}

/**
 * 원장에 남는 사유.
 *
 * 관리자 조정은 원화와 짝이 없어 따로 둡니다 — 매출·충전 집계에서 빼야 합니다.
 */
export type AdminCatMoneyReason = 'ADMIN_GRANT' | 'ADMIN_BURN';

/** 체인 반영 상태. PENDING 이면 아직 잔액이 안 바뀐 것입니다 */
export type CatTxStatus = 'PENDING' | 'CONFIRMED' | 'ALREADY_DONE' | 'FAILED';

/**
 * 서버 `AdminCatMoneyAdjustResponse`.
 *
 * 🔴 이게 왔다고 잔액이 바뀐 게 아닙니다. 체인에 보냈을 뿐이고 확정까지 약 10초
 * 걸립니다(`status: 'PENDING'`). 바로 잔액을 다시 부르면 옛 값이 옵니다.
 */
export interface AdminCatMoneyAdjustResult {
  userId: number;
  reason: AdminCatMoneyReason;
  /** 관리자가 입력한 금액 */
  requestedAmount: number;
  /** 실제로 반영한 금액. 차감은 가용 잔액을 넘지 못해 줄어들 수 있습니다 */
  appliedAmount: number;
  status: CatTxStatus;
  /** 이미 처리된 작업이면 없습니다 */
  txHash: string | null;
}

/** 넣기/빼기. 부호가 아니라 값으로 방향을 표현합니다 — 부호는 잘못 읽기 쉽습니다 */
export type AdminCatMoneyDirection = 'grant' | 'burn';
