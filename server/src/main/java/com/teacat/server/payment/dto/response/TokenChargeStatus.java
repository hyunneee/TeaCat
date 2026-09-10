package com.teacat.server.payment.dto.response;

import com.teacat.server.wallet.entity.CatTxStatus;

/**
 * 화면이 보는 충전 상태. DB 에 저장하지 않고 발행 트랜잭션 상태에서 계산합니다.
 *
 * <p>체인 확정에 블록 하나(10초)가 걸리므로 "결제는 끝났는데 잔액에 아직 안 잡히는" 구간이
 * 반드시 생깁니다. 그 구간을 실패로 보이게 하면 안 되어 상태를 따로 내려줍니다.
 */
public enum TokenChargeStatus {

    /** 결제는 승인됐고 캣머니 발행이 아직 확정되지 않았습니다 */
    MINTING,
    /** 잔액에 반영됐습니다 */
    COMPLETED,
    /** 발행이 체인에서 실패했습니다. 재시도 대상이며 고객센터 확인이 필요합니다 */
    FAILED;

    public static TokenChargeStatus from(CatTxStatus mintStatus) {
        if (mintStatus == null) {
            return MINTING;
        }

        return switch (mintStatus) {
            case CONFIRMED, ALREADY_DONE -> COMPLETED;
            case FAILED -> FAILED;
            case PENDING -> MINTING;
        };
    }
}
