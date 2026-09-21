package com.teacat.server.wallet.client;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;

/** 블록체인 API가 돌려준 도메인 코드를 잃지 않는 호출 예외. */
@Getter
public class BlockchainApiException extends BusinessException {

    private final String remoteCode;
    private final String remoteMessage;

    public BlockchainApiException(ErrorCode fallback, String remoteCode, String remoteMessage) {
        super(fallback);
        this.remoteCode = remoteCode;
        this.remoteMessage = remoteMessage;
    }
}
