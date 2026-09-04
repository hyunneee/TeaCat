package com.teacat.server.nft.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum NftErrorCode implements ErrorCode {

    PHOTOCARD_NOT_FOUND(HttpStatus.NOT_FOUND, "NFT_001", "존재하지 않는 포토카드입니다."),
    DESIGN_NOT_FOUND(HttpStatus.NOT_FOUND, "NFT_002", "존재하지 않는 포토카드 도안입니다."),
    PHOTOCARD_NOT_OWNED(HttpStatus.FORBIDDEN, "NFT_003", "본인이 소유한 포토카드가 아닙니다."),
    PHOTOCARD_ALREADY_LISTED(HttpStatus.CONFLICT, "NFT_004", "이미 판매 등록된 포토카드입니다."),
    LISTING_NOT_FOUND(HttpStatus.NOT_FOUND, "NFT_005", "활성 판매 등록 정보를 찾을 수 없습니다."),
    LISTING_OWNER_MISMATCH(HttpStatus.FORBIDDEN, "NFT_006", "본인의 판매 등록이 아닙니다."),
    SELF_PURCHASE_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "NFT_007", "본인이 판매 중인 포토카드는 구매할 수 없습니다."),
    LISTING_ALREADY_CLOSED(HttpStatus.CONFLICT, "NFT_008", "이미 판매 완료되었거나 취소된 포토카드입니다."),
    INVALID_IDEMPOTENCY_KEY(HttpStatus.BAD_REQUEST, "NFT_009", "Idempotency-Key는 UUID 형식이어야 합니다."),
    IDEMPOTENCY_KEY_REUSED(HttpStatus.CONFLICT, "NFT_010", "다른 요청에서 이미 사용한 Idempotency-Key입니다."),
    INVALID_CURSOR(HttpStatus.BAD_REQUEST, "NFT_011", "페이지 커서가 올바르지 않습니다."),
    INVALID_PAGE_SIZE(HttpStatus.BAD_REQUEST, "NFT_012", "페이지 크기는 1 이상 100 이하여야 합니다."),
    PERFORMANCE_NOT_FOUND(HttpStatus.NOT_FOUND, "NFT_013", "존재하지 않는 공연입니다."),
    DESIGN_QUANTITY_EXCEEDED(HttpStatus.BAD_REQUEST, "NFT_014", "도안의 남은 수량을 초과했습니다."),
    ALLOCATION_QUANTITY_MISMATCH(HttpStatus.BAD_REQUEST, "NFT_015", "도안 배정 수량 합계가 발급 대상 티켓 수와 일치하지 않습니다."),
    PHOTOCARDS_ALREADY_ISSUED(HttpStatus.CONFLICT, "NFT_016", "이미 포토카드가 발급된 공연입니다."),
    DESIGN_PERFORMANCE_MISMATCH(HttpStatus.BAD_REQUEST, "NFT_017", "해당 공연의 포토카드 도안이 아닙니다."),
    DUPLICATE_DESIGN_ALLOCATION(HttpStatus.BAD_REQUEST, "NFT_018", "같은 도안을 중복해서 배정할 수 없습니다."),
    PHOTOCARD_OWNER_NOT_FOUND(HttpStatus.CONFLICT, "NFT_019", "포토카드를 받을 회원 정보를 찾을 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}

