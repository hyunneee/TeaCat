package com.teacat.server.nft.dto.request;

public enum NftAuctionSort {
    /** 마감 임박순 (기본) */
    ENDING_SOON,
    /** 현재가 낮은 순 */
    CURRENT_PRICE,
    /** 최근 등록순 */
    RECENT
}
