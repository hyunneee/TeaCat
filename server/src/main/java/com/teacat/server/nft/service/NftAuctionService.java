package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftAuctionProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftAuctionSort;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.response.MyNftBidResponse;
import com.teacat.server.nft.dto.response.NftAuctionBidHistoryResponse;
import com.teacat.server.nft.dto.response.NftAuctionDetailResponse;
import com.teacat.server.nft.dto.response.NftAuctionResponse;
import com.teacat.server.nft.dto.response.NftAuctionSummaryResponse;
import com.teacat.server.nft.dto.response.NftBidResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
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
import java.util.List;
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

    private static final String AUCTION_SCOPE_PREFIX = "auction:";
    private static final String BIDS_SCOPE = "auction-bids";
    private static final String MY_AUCTIONS_SCOPE = "my-auctions";

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
    private final NftCursorCodec cursorCodec;

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
        Duration duration = request.resolveDuration();
        if (!properties.isDurationAllowed(duration)) {
            throw new BusinessException(NftErrorCode.INVALID_AUCTION_DURATION);
        }

        NftPhotocard photocard = photocardRepository.findByIdForUpdate(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        if (!photocard.isOwnedBy(sellerId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_OWNED);
        }
        if (!photocard.isMinted()) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_MINTED);
        }
        if (listingRepository.existsByPhotocardIdAndStatusIn(
                photocardId, List.of(NftListingStatus.ACTIVE, NftListingStatus.SETTLING))) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_ALREADY_LISTED);
        }
        if (auctionRepository.existsByPhotocardIdAndStatusIn(
                photocardId, List.of(NftAuctionStatus.ACTIVE, NftAuctionStatus.SETTLING))) {
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

        NftPhotocardTrade trade = tradeRepository.saveAndFlush(
                NftPhotocardTrade.pendingAuction(auction, buyer, price, idempotencyKey));
        trade.initializeSettlement(CatMoneyHoldRefType.NFT_TRADE_BUYER, trade.getId());
        holdService.hold(buyerId, price, CatMoneyHoldRefType.NFT_TRADE_BUYER, trade.getId());
        holdService.holdIncoming(auction.getSeller().getId(), price,
                CatMoneyHoldRefType.NFT_TRADE_SELLER, trade.getId());
        auction.startSettlement(buyer, price, LocalDateTime.now());
        return NftPurchaseResponse.from(trade);
    }

    public NftCursorPageResponse<NftAuctionSummaryResponse> getAuctions(Long performanceId, String keyword,
                                                                        NftAuctionSort sort, String cursor,
                                                                        Integer requestedSize) {
        int size = NftRequestSupport.validateSize(requestedSize);
        NftAuctionSort effectiveSort = sort == null ? NftAuctionSort.ENDING_SOON : sort;
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, AUCTION_SCOPE_PREFIX + effectiveSort.name());
        validateAuctionCursor(decoded, effectiveSort);

        List<NftAuctionQueryRepository.AuctionRow> rows = queryRepository.findActiveAuctions(
                performanceId, normalizeKeyword(keyword), effectiveSort, decoded.value(), decoded.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftAuctionQueryRepository.AuctionRow> page = takePage(rows, size);
        String nextCursor = hasNext ? auctionCursor(effectiveSort, page.getLast()) : null;
        return new NftCursorPageResponse<>(page.stream().map(NftAuctionSummaryResponse::from).toList(),
                nextCursor, hasNext);
    }

    /**
     * 경매 상세. 만료된 경매면 먼저 닫아서 확정 결과를 돌려준다 — 그래서 readOnly 가 아니다.
     * 읽기 경로는 거절 예외가 없으므로 합류한 close 가 롤백되지 않는다 (쓰기 경로가 close 를 안 부르는 이유는 클래스 주석).
     *
     * @param viewerId 로그인 사용자 id. 비로그인이면 null 이고 viewer 블록이 빠진다
     */
    @Transactional
    public NftAuctionDetailResponse getAuction(Long auctionId, Long viewerId) {
        closer.close(auctionId);
        NftAuctionQueryRepository.AuctionDetailRow row = queryRepository.findAuctionDetail(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));

        NftAuctionDetailResponse.Viewer viewer = null;
        if (viewerId != null) {
            viewer = new NftAuctionDetailResponse.Viewer(
                    viewerId.equals(row.sellerId()),
                    viewerId.equals(row.topBidderId()),
                    bidRepository.findMyHighestBid(auctionId, viewerId).orElse(null));
        }
        Long finalPrice = row.status() == NftAuctionStatus.SOLD ? row.currentPrice() : null;
        return new NftAuctionDetailResponse(
                row.auctionId(), row.status(),
                new NftAuctionDetailResponse.Photocard(row.photocardId(), row.designName(), row.imageUrl(),
                        row.performanceTitle()),
                row.sellerNickname(), row.startPrice(), row.currentPrice(), row.buyNowPrice(), row.bidCount(),
                row.topBidderNickname(), row.createdAt(), row.endsAt(), row.closedAt(), row.winnerNickname(),
                finalPrice, viewer);
    }

    public NftCursorPageResponse<NftAuctionBidHistoryResponse> getBids(Long auctionId, String cursor,
                                                                       Integer requestedSize) {
        if (!auctionRepository.existsById(auctionId)) {
            throw new BusinessException(NftErrorCode.AUCTION_NOT_FOUND);
        }
        int size = NftRequestSupport.validateSize(requestedSize);
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, BIDS_SCOPE);

        List<NftAuctionQueryRepository.BidRow> rows = queryRepository.findBids(auctionId, decoded.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftAuctionQueryRepository.BidRow> page = takePage(rows, size);
        String nextCursor = hasNext
                ? cursorCodec.encode(BIDS_SCOPE, page.getLast().bidId().toString(), page.getLast().bidId())
                : null;
        return new NftCursorPageResponse<>(page.stream()
                .map(r -> new NftAuctionBidHistoryResponse(r.bidId(), r.bidderNickname(), r.amount(), r.bidAt()))
                .toList(), nextCursor, hasNext);
    }

    public NftCursorPageResponse<NftAuctionSummaryResponse> getMyAuctions(Long userId, NftAuctionStatus status,
                                                                          String cursor, Integer requestedSize) {
        int size = NftRequestSupport.validateSize(requestedSize);
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, MY_AUCTIONS_SCOPE);
        LocalDateTime cursorAt = decoded.present() ? parseTime(decoded.value()) : null;

        List<NftAuctionQueryRepository.AuctionRow> rows = queryRepository.findMyAuctions(
                userId, status, cursorAt, decoded.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftAuctionQueryRepository.AuctionRow> page = takePage(rows, size);
        String nextCursor = hasNext
                ? cursorCodec.encode(MY_AUCTIONS_SCOPE, page.getLast().createdAt().toString(), page.getLast().auctionId())
                : null;
        return new NftCursorPageResponse<>(page.stream().map(NftAuctionSummaryResponse::from).toList(),
                nextCursor, hasNext);
    }

    public NftCursorPageResponse<MyNftBidResponse> getMyBids(Long userId, String cursor, Integer requestedSize) {
        return getMyBids(userId, cursor, requestedSize, null, null);
    }

    public NftCursorPageResponse<MyNftBidResponse> getMyBids(Long userId, String cursor, Integer requestedSize,
                                                          String from, String to) {
        BidDateRange range = BidDateRange.parse(from, to);
        int size = NftRequestSupport.validateSize(requestedSize);
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, range.cursorScope());
        Long cursorLastBidId = decoded.present() ? parseLong(decoded.value()) : null;

        List<NftAuctionQueryRepository.MyBidRow> rows = queryRepository.findMyBids(userId, cursorLastBidId, size + 1,
                range.from(), range.toExclusive());
        boolean hasNext = rows.size() > size;
        List<NftAuctionQueryRepository.MyBidRow> page = takePage(rows, size);
        String nextCursor = hasNext
                ? cursorCodec.encode(range.cursorScope(), page.getLast().lastBidId().toString(), page.getLast().auctionId())
                : null;
        return new NftCursorPageResponse<>(page.stream().map(r -> toMyBid(userId, r)).toList(), nextCursor, hasNext);
    }

    private MyNftBidResponse toMyBid(Long userId, NftAuctionQueryRepository.MyBidRow row) {
        boolean isTop = userId.equals(row.topBidderId());
        MyNftBidResponse.Result result;
        if (row.status() == NftAuctionStatus.ACTIVE) {
            result = isTop ? MyNftBidResponse.Result.BIDDING : MyNftBidResponse.Result.OUTBID;
        } else if (row.status() == NftAuctionStatus.SETTLING) {
            result = userId.equals(row.winnerId())
                    ? MyNftBidResponse.Result.SETTLING
                    : MyNftBidResponse.Result.LOST;
        } else {
            // 입찰이 있으면 취소·유찰이 불가능하므로 종료된 경매는 SOLD 다
            result = userId.equals(row.winnerId()) ? MyNftBidResponse.Result.WON : MyNftBidResponse.Result.LOST;
        }
        return new MyNftBidResponse(row.auctionId(), row.photocardId(), row.designName(), row.imageUrl(),
                row.myHighestBid(), row.currentPrice(), isTop, row.status(), row.endsAt(), result, row.lastBidAt());
    }

    private String auctionCursor(NftAuctionSort sort, NftAuctionQueryRepository.AuctionRow row) {
        String value = switch (sort) {
            case ENDING_SOON -> row.endsAt().toString();
            case CURRENT_PRICE -> row.currentPrice().toString();
            case RECENT -> row.createdAt().toString();
        };
        return cursorCodec.encode(AUCTION_SCOPE_PREFIX + sort.name(), value, row.auctionId());
    }

    private void validateAuctionCursor(NftCursorCodec.Cursor cursor, NftAuctionSort sort) {
        if (!cursor.present()) {
            return;
        }
        if (sort == NftAuctionSort.CURRENT_PRICE) {
            parseLong(cursor.value());
        } else {
            parseTime(cursor.value());
        }
    }

    private LocalDateTime parseTime(String value) {
        try {
            return LocalDateTime.parse(value);
        } catch (RuntimeException e) {
            throw new BusinessException(NftErrorCode.INVALID_CURSOR);
        }
    }

    private Long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (RuntimeException e) {
            throw new BusinessException(NftErrorCode.INVALID_CURSOR);
        }
    }

    private String normalizeKeyword(String keyword) {
        return keyword == null || keyword.isBlank() ? null : keyword.trim();
    }

    private <T> List<T> takePage(List<T> rows, int size) {
        return rows.size() > size ? List.copyOf(rows.subList(0, size)) : List.copyOf(rows);
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
