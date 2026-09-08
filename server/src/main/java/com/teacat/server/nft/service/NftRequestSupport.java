package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;

import java.util.UUID;

/** NftService 와 NftAuctionService 가 같이 쓰는 요청 검증 */
final class NftRequestSupport {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 100;

    private NftRequestSupport() {
    }

    static int validateSize(Integer requestedSize) {
        int size = requestedSize == null ? DEFAULT_PAGE_SIZE : requestedSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new BusinessException(NftErrorCode.INVALID_PAGE_SIZE);
        }
        return size;
    }

    static UUID parseIdempotencyKey(String header) {
        try {
            return UUID.fromString(header);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BusinessException(NftErrorCode.INVALID_IDEMPOTENCY_KEY);
        }
    }
}
