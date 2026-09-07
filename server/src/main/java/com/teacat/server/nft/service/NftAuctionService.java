package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftAuctionProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.response.NftAuctionResponse;
import com.teacat.server.nft.dto.response.NftBidResponse;
import com.teacat.server.nft.dto.response.NftPurchaseResponse;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionBid;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionBidRepository;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.nft.repository.NftPhotocardListingRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * NFT 포토카드 경매 — 등록·취소·입찰·즉시구매·조회.
 *
 * 마감은 여기서 하지 않는다. {@code NftAuctionCloser} 가 멱등하게 닫는다.
 * <ul>
 *   <li>쓰기 경로(입찰·즉시구매)는 마감을 <b>부르지 않고</b> DB 시각으로 거절만 한다({@code AUCTION_ENDED}).
 *       같은 트랜잭션에서 닫은 뒤 거절 예외를 던지면 롤백이 마감까지 되돌리고, 마감을 별도 트랜잭션으로
 *       떼면 요청 하나가 커넥션 둘을 잡아 입찰이 몰릴 때 풀이 마른다.</li>
 *   <li>읽기 경로(상세 조회)는 거절할 일이 없으므로 먼저 닫고 확정 결과를 돌려준다(지연 마감).</li>
 *   <li>나머지는 스위퍼가 주기적으로 닫는다.</li>
 * </ul>
 *
 * 락 순서는 모든 경로에서 경매 행 → 포카 행 → 유저 advisory lock(홀드 안) 이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NftAuctionService {

    private final NftAuctionRepository auctionRepository;
    private final NftAuctionBidRepository bidRepository;
    private final NftAuctionQueryRepository queryRepository;
    private final NftPhotocardRepository photocardRepository;
    private final NftPhotocardListingRepository listingRepository;
    private final NftPhotocardTradeRepository tradeRepository;
    private final UserRepository userRepository;
    private final CatMoneyHoldService holdService;
    private final NftAuctionProperties properties;
    private final NftAuctionCloser closer;

    /**
     * 경매 등록.
     *
     * 포카 행을 먼저 잠근 뒤 고정가·경매 ACTIVE 여부를 확인한다. {@code NftService.registerListing} 도 같은 락을
     * 먼저 잡으므로 두 경로가 동시에 들어와도 한쪽만 통과한다 — 두 테이블에 걸친 "동시 등록 금지" 는 이 규율로 지킨다.
     */
    @Transactional
    public NftAuctionResponse createAuction(Long sellerId, Long photocardId, NftAuctionCreateRequest request) {
        if (request.buyNowPrice() != null && request.buyNowPrice() <= request.startPrice()) {
            throw new BusinessException(NftErrorCode.INVALID_BUY_NOW_PRICE);
        }
        Duration duration = Duration.ofHours(request.durationHours());
        if (!properties.isDurationAllowed(duration)) {
            throw new BusinessException(NftErrorCode.INVALID_AUCTION_DURATION);
        }

        NftPhotocard photocard = photocardRepository.findByIdForUpdate(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        if (!photocard.isOwnedBy(sellerId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_OWNED);
        }
        if (listingRepository.existsByPhotocardIdAndStatus(photocardId, NftListingStatus.ACTIVE)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_ALREADY_LISTED);
        }
        if (auctionRepository.existsByPhotocardIdAndStatus(photocardId, NftAuctionStatus.ACTIVE)) {
            throw new BusinessException(NftErrorCode.AUCTION_ALREADY_ACTIVE);
        }

        // 마감 시각은 DB 시계로 잡는다. 마감 판정(ends_at <= now())과 같은 시계여야 한다
        NftAuction auction = auctionRepository.save(NftAuction.create(
                photocard, photocard.getOwner(), request.startPrice(), request.buyNowPrice(),
                queryRepository.currentTime().plus(duration)));
        return NftAuctionResponse.from(auction);
    }

    /**
     * 판매자 취소. 권한·상태·입찰 유무를 UPDATE 의 WHERE 로 한 번에 판정하고, 실패했을 때만 사유를 읽는다.
     */
    @Transactional
    public void cancelAuction(Long sellerId, Long auctionId) {
        if (auctionRepository.cancelIfNoBids(auctionId, sellerId) == 1) {
            return;
        }
        NftAuction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));
        if (!auction.isSeller(sellerId)) {
            throw new BusinessException(NftErrorCode.LISTING_OWNER_MISMATCH);
        }
        if (!auction.isActive()) {
            throw new BusinessException(NftErrorCode.AUCTION_NOT_ACTIVE);
        }
        throw new BusinessException(NftErrorCode.AUCTION_HAS_BIDS);
    }

    /**
     * 입찰.
     *
     * 경매 행을 잠가 한 경매의 입찰을 줄 세운다. 락을 기다린 요청은 갱신된 현재가로 다시 검사되므로
     * 같은 금액을 동시에 넣어도 한 건만 통과한다. 담보는 입찰 행이 생긴 뒤 홀드로 잡고, 잔액이 부족하면
     * 예외가 올라가 입찰 행까지 함께 롤백된다.
     */
    @Transactional
    public NftBidResponse placeBid(Long bidderId, Long auctionId, NftBidRequest request) {
        NftAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));
        validateBiddable(auction, bidderId, request.amount());

        User bidder = getUser(bidderId);
        NftAuctionBid bid = bidRepository.save(NftAuctionBid.place(auction, bidder, request.amount()));
        holdService.hold(bidderId, request.amount(), CatMoneyHoldRefType.AUCTION_BID, bid.getId());

        NftAuctionBid previousTop = auction.getTopBid();
        if (previousTop != null) {
            holdService.release(CatMoneyHoldRefType.AUCTION_BID, previousTop.getId());
        }
        auction.acceptBid(bid);
        return NftBidResponse.of(bid, auction);
    }

    private void validateBiddable(NftAuction auction, Long bidderId, Long amount) {
        if (!auction.isActive()) {
            throw new BusinessException(NftErrorCode.AUCTION_NOT_ACTIVE);
        }
        // 마감 시각은 지났는데 스위퍼가 아직 안 닫은 경매. 마감 판정과 같은 DB 시계로 본다
        if (isEnded(auction)) {
            throw new BusinessException(NftErrorCode.AUCTION_ENDED);
        }
        if (auction.isSeller(bidderId)) {
            throw new BusinessException(NftErrorCode.SELLER_CANNOT_BID);
        }
        if (auction.isTopBidder(bidderId)) {
            throw new BusinessException(NftErrorCode.ALREADY_TOP_BIDDER);
        }
        if (amount <= auction.getCurrentPrice()) {
            throw new BusinessException(NftErrorCode.BID_TOO_LOW);
        }
        if (auction.hasBuyNow() && amount >= auction.getBuyNowPrice()) {
            throw new BusinessException(NftErrorCode.BID_NOT_BELOW_BUY_NOW);
        }
    }

    /**
     * 즉시구매. 판매자가 정한 가격으로 바로 체결하고 경매를 끝낸다.
     *
     * 고정가 구매와 같은 멱등 처리(UUID Idempotency-Key, (buyer_id, idempotency_key) 유니크). 구매자의 돈은
     * hold → capture 를 한 트랜잭션에서 거친다 — "돈이 나가는 경로는 capture 하나" 를 지키기 위해서다.
     * 현재 최고 입찰자는 낸 돈이 없으므로 홀드만 풀어준다.
     */
    @Transactional
    public NftPurchaseResponse buyNow(Long buyerId, Long auctionId, String idempotencyKeyHeader) {
        UUID idempotencyKey = NftRequestSupport.parseIdempotencyKey(idempotencyKeyHeader);
        NftPhotocardTrade existing = tradeRepository.findByBuyerIdAndIdempotencyKey(buyerId, idempotencyKey)
                .orElse(null);
        if (existing != null) {
            return sameAuctionOrThrow(existing, auctionId);
        }

        NftAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));
        // 락을 기다리는 동안 같은 키의 요청이 끝났을 수 있다
        existing = tradeRepository.findByBuyerIdAndIdempotencyKey(buyerId, idempotencyKey).orElse(null);
        if (existing != null) {
            return sameAuctionOrThrow(existing, auctionId);
        }

        if (!auction.isActive()) {
            throw new BusinessException(NftErrorCode.AUCTION_NOT_ACTIVE);
        }
        if (isEnded(auction)) {
            throw new BusinessException(NftErrorCode.AUCTION_ENDED);
        }
        if (!auction.hasBuyNow()) {
            throw new BusinessException(NftErrorCode.BUY_NOW_NOT_AVAILABLE);
        }
        if (auction.isSeller(buyerId)) {
            throw new BusinessException(NftErrorCode.SELF_PURCHASE_NOT_ALLOWED);
        }

        NftPhotocard photocard = photocardRepository.findByIdForUpdate(auction.getPhotocard().getId())
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        User buyer = getUser(buyerId);
        Long price = auction.getBuyNowPrice();

        holdService.hold(buyerId, price, CatMoneyHoldRefType.AUCTION_BUY_NOW, auctionId);
        holdService.capture(CatMoneyHoldRefType.AUCTION_BUY_NOW, auctionId);
        if (auction.hasBids()) {
            holdService.release(CatMoneyHoldRefType.AUCTION_BID, auction.getTopBid().getId());
        }

        photocard.transferTo(buyer);
        auction.soldTo(buyer, price, LocalDateTime.now());
        NftPhotocardTrade trade = tradeRepository.saveAndFlush(
                NftPhotocardTrade.fromAuction(auction, buyer, price, idempotencyKey));
        return NftPurchaseResponse.from(trade);
    }

    /** 마감 시각이 지났는가. 판정은 서버 시계가 아니라 DB now() 다 — 마감 처리(ends_at <= now())와 같은 시계여야 한다 */
    private boolean isEnded(NftAuction auction) {
        return !auction.getEndsAt().isAfter(queryRepository.currentTime());
    }

    private NftPurchaseResponse sameAuctionOrThrow(NftPhotocardTrade trade, Long auctionId) {
        if (trade.getAuction() == null || !trade.getAuction().getId().equals(auctionId)) {
            throw new BusinessException(NftErrorCode.IDEMPOTENCY_KEY_REUSED);
        }
        return NftPurchaseResponse.from(trade);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
    }
}
