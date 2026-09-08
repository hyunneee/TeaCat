package com.teacat.server.wallet.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum WalletErrorCode implements ErrorCode {

    /** 블록체인 서비스에 닿지 못했거나 거절당했다. 가입 자체를 실패로 되돌린다 */
    WALLET_CREATION_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "WALLET_001",
            "지갑을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."),
    /** 블록체인 서비스 주소·키가 설정되지 않았다 */
    BLOCKCHAIN_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "WALLET_002",
            "지갑 서비스가 아직 준비되지 않았습니다."),

    /** 지갑 연동 전에 가입한 회원. 조용히 0 으로 넘기면 "잔액 0" 과 구분되지 않는다 */
    WALLET_NOT_FOUND(HttpStatus.NOT_FOUND, "WALLET_003",
            "지갑이 없습니다. 고객센터에 문의해 주세요."),
    /** 체인 조회 실패. 잠시 후 다시 시도하면 된다 */
    BALANCE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "WALLET_004",
            "잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."),

    /**
     * 가용 잔액(체인 잔액 − 유효 홀드 − 미확정 소각)이 요청 금액보다 적다.
     *
     * 번호를 옮기지 마세요 — 이미 배포되어 프론트가 이 코드로 분기합니다.
     */
    INSUFFICIENT_BALANCE(HttpStatus.CONFLICT, "WALLET_005",
            "캣머니 가용 잔액이 부족합니다."),

    /**
     * 캣머니 발행 요청이 나가지 못했다.
     *
     * 결제는 이미 승인된 뒤라 사용자에게 실패로 보여선 안 된다. 부르는 쪽이 잡아서
     * "충전 반영 중" 으로 넘기고 재시도 배치에 맡긴다.
     */
    MINT_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "WALLET_006",
            "캣머니를 발행하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    /** 트랜잭션 확정 조회 실패. 확정 폴링이 다음 차례에 다시 본다 */
    TX_REPORT_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "WALLET_007",
            "거래 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
