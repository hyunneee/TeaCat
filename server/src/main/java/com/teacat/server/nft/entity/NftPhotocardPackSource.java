package com.teacat.server.nft.entity;

/** DB 의 nft_photocard_pack_source ENUM 과 1:1 */
public enum NftPhotocardPackSource {

    /**
     * 입장 확인 시 지급. <b>아직 지급 경로가 없다</b> — 얼굴 대조 입장이 생기면 쓴다.
     * 값을 지우지 않는 이유가 그것이다.
     */
    TICKET_ENTRY,
    /** 티켓 구매 시 지급. {@code source_ref = 티켓 id} */
    TICKET_PURCHASE,
    EVENT
}
