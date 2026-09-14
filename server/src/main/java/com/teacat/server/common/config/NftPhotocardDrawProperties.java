package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 nft.photocard.draw.* 설정.
 *
 * @param sweepInterval  체인 전송을 못 한 뽑기 카드를 다시 보내는 주기. @Scheduled 문자열로 쓰이므로 ISO-8601(PT60S)
 * @param sweepBatchSize 한 주기에 보낼 최대 카드 수 (컨트랙트 MAX_BATCH 200 을 넘지 않게)
 * @param sweepEnabled   스위퍼 켬/끔. 테스트에서 끈다
 */
/* 2026-09-11: eventCode 컴포넌트를 nft_photocard_pack_events 표로 옮겼다.
 * @param eventCode      이벤트 팩 지급 코드. {@code nft_photocard_packs.source_ref} 에 그대로 들어가
 *                       계정당 한 번을 지킨다. 비우면 이벤트가 없는 것이고, 바꾸면 새 이벤트다(같은 계정이 또 받는다)
 */
@ConfigurationProperties(prefix = "nft.photocard.draw")
public record NftPhotocardDrawProperties(
        /* 2026-09-11: 이벤트 판정이 nft_photocard_pack_events 표로 옮겨갔다.
           설정으로 두면 여닫을 때마다 서버 재시작이 필요해 어드민 화면에서 다룰 수 없었다.
        String eventCode,
        */
        Duration sweepInterval,
        int sweepBatchSize,
        boolean sweepEnabled
) {

    /* 2026-09-11: 위 eventCode 와 함께 표로 옮겨갔다. NftPhotocardPackEventRepository.findOngoing() 이 대신한다.
    public boolean hasEvent() {
        return eventCode != null && !eventCode.isBlank();
    }
    */
}
