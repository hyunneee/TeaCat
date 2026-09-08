package com.teacat.server.nft.service;

import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionBid;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 경매 한 건을 마감한다. 멱등 — 마감 조건(ACTIVE 이고 ends_at 이 지남)에 맞지 않으면 아무것도 하지 않는다.
 *
 * 스위퍼와 상세 조회(지연 마감)가 부른다. 한 건당 트랜잭션 하나이며, 스위퍼와 별도 빈인 이유는
 * {@code @Scheduled} 메서드에서 같은 클래스의 {@code @Transactional} 을 부르면 프록시를 거치지 않기 때문이다.
 *
 * 동시에 둘이 들어와도 {@code findExpiredActiveForUpdate} 가 락을 기다린 쪽에 빈 결과를 돌려주므로
 * 락 라이브러리 없이 한 번만 처리된다.
 *
 * <b>입찰·즉시구매 같은 쓰기 경로에서는 부르지 않는다.</b> 호출자 트랜잭션에 합류(REQUIRED)하므로, 닫은 뒤
 * 호출자가 거절 예외를 던지면 롤백이 마감까지 되돌린다. REQUIRES_NEW 로 떼면 요청 하나가 커넥션 둘을 잡아
 * 입찰이 몰리는 마감 직전에 풀이 마른다. 쓰기 경로는 DB 시각으로 거절만 하고, 마감은 스위퍼와 조회에 맡긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftAuctionCloser {

    private final NftAuctionRepository auctionRepository;
    private final NftPhotocardRepository photocardRepository;
    private final NftPhotocardTradeRepository tradeRepository;
    private final CatMoneyHoldService holdService;

    /** @return 이 호출로 마감 처리가 일어났으면 true */
    @Transactional
    public boolean close(Long auctionId) {
        NftAuction auction = auctionRepository.findExpiredActiveForUpdate(auctionId).orElse(null);
        if (auction == null) {
            return false;
        }

        LocalDateTime now = LocalDateTime.now();
        if (!auction.hasBids()) {
            auction.expire(now);
            // 상세 조회처럼 같은 트랜잭션에서 native SQL 로 곧바로 다시 읽는 호출자가 있다.
            // 영속성 컨텍스트의 변경을 DB 에 밀어 넣지 않으면 그 읽기가 옛 행을 본다
            auctionRepository.flush();
            log.info("경매 유찰 auctionId={}", auctionId);
            return true;
        }

        NftAuctionBid winningBid = auction.getTopBid();
        User winner = winningBid.getBidder();
        NftPhotocard photocard = photocardRepository.findByIdForUpdate(auction.getPhotocard().getId())
                .orElseThrow(() -> new IllegalStateException("경매의 포토카드가 없다 auctionId=" + auctionId));

        // 낙찰자의 담보를 확정한다. 최고 입찰 홀드는 밀리지 않았으므로 반드시 ACTIVE 여야 한다
        if (!holdService.capture(CatMoneyHoldRefType.AUCTION_BID, winningBid.getId())) {
            throw new IllegalStateException("최고 입찰의 홀드가 없거나 이미 끝났다 bidId=" + winningBid.getId());
        }

        photocard.transferTo(winner);
        auction.soldTo(winner, winningBid.getAmount(), now);
        tradeRepository.save(NftPhotocardTrade.fromAuction(auction, winner, winningBid.getAmount(), UUID.randomUUID()));
        auctionRepository.flush(); // 위 유찰 분기와 같은 이유
        log.info("경매 낙찰 auctionId={} winnerId={} price={}", auctionId, winner.getId(), winningBid.getAmount());
        return true;
    }
}
