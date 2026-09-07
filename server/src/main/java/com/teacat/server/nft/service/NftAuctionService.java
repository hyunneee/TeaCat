package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftAuctionProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.response.NftAuctionResponse;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocard;
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
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

/**
 * NFT 포토카드 경매 — 등록·취소·입찰·즉시구매·조회.
 *
 * 마감은 여기서 하지 않는다. {@code NftAuctionCloser} 가 멱등하게 닫고, 이 서비스는 상태를 바꾸기 전에
 * {@code closer.close(id)} 를 한 번 불러 만료된 경매가 열린 채 남지 않게 한다(지연 마감).
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

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
    }
}
