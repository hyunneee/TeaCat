package com.teacat.server.nft.service;

import com.teacat.server.nft.repository.NftAuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 경매 한 건을 마감한다. 멱등 — 마감 조건(ACTIVE 이고 ends_at 이 지남)에 맞지 않으면 아무것도 하지 않는다.
 *
 * 스위퍼와 서비스(지연 마감)가 둘 다 부른다. 한 건당 트랜잭션 하나이며, 스위퍼와 별도 빈인 이유는
 * {@code @Scheduled} 메서드에서 같은 클래스의 {@code @Transactional} 을 부르면 프록시를 거치지 않기 때문이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftAuctionCloser {

    private final NftAuctionRepository auctionRepository;

    /** @return 이 호출로 마감 처리가 일어났으면 true */
    @Transactional
    public boolean close(Long auctionId) {
        return auctionRepository.findExpiredActiveForUpdate(auctionId).isPresent();
        // Task 10 에서 낙찰/유찰 처리를 채운다
    }
}
