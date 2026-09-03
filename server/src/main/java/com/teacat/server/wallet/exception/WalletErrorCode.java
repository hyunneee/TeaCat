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
            "지갑 서비스가 아직 준비되지 않았습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
