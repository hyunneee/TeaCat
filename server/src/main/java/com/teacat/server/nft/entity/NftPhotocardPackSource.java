package com.teacat.server.nft.entity;

/** DB 의 nft_photocard_pack_source ENUM 과 1:1. 팩을 어디서 받았나 */
public enum NftPhotocardPackSource {
    /** 담당자가 입장을 확인한 티켓. source_ref = 티켓 id. 아직 지급 경로가 없다(다음 작업) */
    TICKET_ENTRY,
    /** 이벤트. source_ref = 이벤트 코드. 계정당 한 번 */
    EVENT
}
