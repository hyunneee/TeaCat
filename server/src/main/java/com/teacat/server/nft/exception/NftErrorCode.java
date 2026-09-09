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
    PHOTOCARD_OWNER_NOT_FOUND(HttpStatus.CONFLICT, "NFT_019", "포토카드를 받을 회원 정보를 찾을 수 없습니다."),

    AUCTION_NOT_FOUND(HttpStatus.NOT_FOUND, "NFT_020", "존재하지 않는 경매입니다."),
    AUCTION_ALREADY_ACTIVE(HttpStatus.CONFLICT, "NFT_021", "이미 경매가 진행 중인 포토카드입니다."),
    AUCTION_NOT_ACTIVE(HttpStatus.CONFLICT, "NFT_022", "종료되었거나 취소된 경매입니다."),
    AUCTION_ENDED(HttpStatus.CONFLICT, "NFT_023", "마감된 경매입니다."),
    AUCTION_HAS_BIDS(HttpStatus.CONFLICT, "NFT_024", "입찰이 있는 경매는 취소할 수 없습니다."),
    SELLER_CANNOT_BID(HttpStatus.BAD_REQUEST, "NFT_025", "본인이 올린 경매에는 입찰할 수 없습니다."),
    ALREADY_TOP_BIDDER(HttpStatus.CONFLICT, "NFT_026", "이미 최고 입찰자입니다."),
    BID_TOO_LOW(HttpStatus.CONFLICT, "NFT_027", "현재가보다 높은 금액으로 입찰해 주세요."),
    BID_NOT_BELOW_BUY_NOW(HttpStatus.BAD_REQUEST, "NFT_028", "즉시구매가 이상은 입찰할 수 없습니다. 즉시구매를 이용해 주세요."),
    BUY_NOW_NOT_AVAILABLE(HttpStatus.CONFLICT, "NFT_029", "즉시구매가 없는 경매입니다."),
    INVALID_AUCTION_DURATION(HttpStatus.BAD_REQUEST, "NFT_030", "경매 기간이 허용 범위를 벗어났습니다."),
    INVALID_BUY_NOW_PRICE(HttpStatus.BAD_REQUEST, "NFT_031", "즉시구매가는 시작가보다 높아야 합니다."),

    /** 블록체인 서비스에 닿지 못했거나 거절당했다. 도안 행은 남으므로 등록만 다시 보내면 된다 */
    DESIGN_REGISTRATION_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "NFT_032",
            "도안을 체인에 등록하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    /** 이미 등록이 확정된 도안. 첫 장이 나가면 온체인 값이 동결되므로 다시 보낼 이유가 없다 */
    DESIGN_ALREADY_REGISTERED(HttpStatus.CONFLICT, "NFT_033", "이미 체인에 등록된 도안입니다."),
    /** 등록 트랜잭션이 아직 확정되지 않았다. 확정 감시가 곧 결과를 채운다 */
    DESIGN_REGISTRATION_IN_PROGRESS(HttpStatus.CONFLICT, "NFT_034",
            "등록 트랜잭션이 아직 확정되지 않았습니다. 잠시 후 다시 확인해 주세요."),
    /** CID 가 없어 등록 요청을 보낼 수 없다. 핀부터 다시 해야 한다 */
    DESIGN_PINS_MISSING(HttpStatus.CONFLICT, "NFT_035",
            "IPFS 핀 정보가 없는 도안입니다. 도안을 다시 등록해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}

