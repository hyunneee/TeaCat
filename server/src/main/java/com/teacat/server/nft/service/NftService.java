package com.teacat.server.nft.service;

import com.teacat.server.auth.security.ClientRequest;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftDesignAllocationRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.MyDesignPhotocardResponse;
import com.teacat.server.nft.dto.response.MyNftPhotocardResponse;
import com.teacat.server.nft.dto.response.MyNftPhotocardSummaryResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftListingResponse;
import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDetailResponse;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.dto.response.NftPhotocardTradeHistoryResponse;
import com.teacat.server.nft.dto.response.NftPhotocardViewResponse;
import com.teacat.server.nft.dto.response.NftPocaDexResponse;
import com.teacat.server.nft.dto.response.NftPurchaseHistoryResponse;
import com.teacat.server.nft.dto.response.NftPurchaseResponse;
import com.teacat.server.nft.dto.response.NftSaleHistoryResponse;
import com.teacat.server.nft.dto.response.NftTradeStatusResponse;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardListing;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.nft.repository.NftPocaDexQueryRepository;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.repository.NftPhotocardListingRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NftService {

    /**
     * 같은 도안을 한 번에 몇 장까지 돌려주나. 도안마다 발행 총량이 있어 현실적으로 닿지
     * 않는 값이지만, 상한 없는 목록 조회를 남기지 않기 위해 걸어 둔다.
     */
    private static final int DESIGN_COPY_LIMIT = 100;

    private static final String MARKET_SCOPE_PREFIX = "market:";
    private static final String PURCHASE_SCOPE = "purchases";
    private static final String SALE_SCOPE = "sales";
    private static final String OWNED_SCOPE = "owned";
    private static final String CARD_TRADE_SCOPE = "card-trades";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final NftPhotocardRepository photocardRepository;
    private final NftAuctionRepository auctionRepository;
    private final NftAuctionQueryRepository auctionQueryRepository;
    private final NftPhotocardDesignRepository designRepository;
    private final NftPhotocardListingRepository listingRepository;
    private final NftPhotocardTradeRepository tradeRepository;
    private final NftMarketQueryRepository queryRepository;
    private final NftPocaDexQueryRepository pocaDexQueryRepository;
    private final UserRepository userRepository;
    private final NftCursorCodec cursorCodec;
    /** 내 카드 응답의 decoratedImageUrl 을 채운다. 🔴 마켓·경매 응답에는 쓰지 않는다 */
    private final NftDecorationService decorationService;
    private final BlockchainProperties blockchainProperties;
    private final CatMoneyHoldService holdService;

    public NftCursorPageResponse<NftMarketPhotocardResponse> getMarketPhotocards(
            Long performanceId, String keyword, NftMarketSort sort, String cursor, Integer requestedSize) {
        int size = validateSize(requestedSize);
        NftMarketSort effectiveSort = sort == null ? NftMarketSort.RECENT : sort;
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, MARKET_SCOPE_PREFIX + effectiveSort.name());
        validateMarketCursor(decoded, effectiveSort);
        String normalizedKeyword = normalizeKeyword(keyword);

        List<NftMarketQueryRepository.MarketRow> rows = queryRepository.findMarketPhotocards(
                performanceId, normalizedKeyword, effectiveSort, decoded.value(), decoded.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.MarketRow> pageRows = takePage(rows, size);
        /* 꾸민 그림을 한 번에 가져온다 (카드마다 부르면 N+1). 마켓에도 꾸민 모습이 보인다 —
           사는 사람이 그대로 받으므로 속이는 것이 아니다 (2026-09-23). */
        Map<Long, String> marketDecorated = decorationService.imageUrlsOf(
                pageRows.stream().map(NftMarketQueryRepository.MarketRow::photocardId).toList());
        List<NftMarketPhotocardResponse> items = pageRows.stream()
                .map(row -> new NftMarketPhotocardResponse(
                        row.photocardId(), row.listingId(), row.designName(), row.imageUrl(),
                        row.performanceTitle(), row.eventName(), row.price(), row.sellerNickname(),
                        row.viewCount(), marketDecorated.get(row.photocardId())))
                .toList();
        String nextCursor = hasNext ? marketCursor(effectiveSort, pageRows.getLast()) : null;
        return new NftCursorPageResponse<>(items, nextCursor, hasNext);
    }

    /**
     * 포토카드 상세.
     *
     * <p>🔴 <b>아무 카드나 보여주지 않는다.</b> 예전에는 ID 만 알면 누구나 열렸다 —
     * 응답에 소유자 닉네임·공연명·<b>좌석(구역·열·번호)</b> 이 들어 있고 ID 가 순번이라,
     * 1000001 부터 훑으면 "누가 어느 공연 어느 자리에 앉았는지" 를 통째로 긁을 수 있었다.
     * 암표를 막자고 만든 서비스에서 가장 내주면 안 되는 조합이다.
     *
     * <p>지금은 <b>마켓에 올라온 카드</b>(판매 중·경매 중)와 <b>본인 카드</b>만 열린다.
     * 나머지는 {@code PHOTOCARD_NOT_FOUND} 로 막는다 — 403 으로 답하면 "그 번호의 카드는
     * 있다" 를 알려주는 셈이라 열거를 도와준다.
     *
     * @param viewerId 로그인하지 않았으면 null (이 경로는 {@code permitAll} 이다)
     */
    public NftPhotocardDetailResponse getPhotocard(Long photocardId, Long viewerId) {
        NftMarketQueryRepository.DetailRow row = queryRepository.findPhotocardDetail(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        NftPhotocardDetailResponse.Listing listing = row.listingId() == null ? null
                : new NftPhotocardDetailResponse.Listing(
                        row.listingId(), row.listingStatus(), row.price(),
                        row.sellerDescription(), row.listedAt());
        // 진행 중 경매는 부분 인덱스(uq_nft_auctions_active) 를 타는 단건 조회다
        NftPhotocardDetailResponse.Auction auction = auctionQueryRepository.findActiveAuctionSummary(photocardId)
                .map(summary -> new NftPhotocardDetailResponse.Auction(
                        summary.auctionId(), summary.status(), summary.currentPrice(), summary.buyNowPrice(),
                        summary.bidCount(), summary.endsAt()))
                .orElse(null);

        boolean isOwner = viewerId != null && viewerId.equals(row.ownerId());
        boolean onMarket = listing != null || auction != null;
        if (!isOwner && !onMarket) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND);
        }

        /* 뽑기 카드는 티켓·좌석이 없다.
           🔴 남에게는 **등급·구역까지만** 준다. 열·번호까지 주면 "이 사람이 정확히 어느 자리에
              앉았다" 가 공개된다 — 카드가 마켓에 올라와 있다고 해서 소유자의 자리를 공개해도
              된다는 뜻은 아니다. 출처를 증명할 만큼은 남기고 개인을 특정할 만큼은 지운다.
              본인에게는 전부 준다 (자기 자리는 이미 안다). */
        NftPhotocardDetailResponse.Origin origin = row.hasTicket()
                ? new NftPhotocardDetailResponse.Origin(
                        row.seatGrade(), row.areaCode(),
                        isOwner ? row.rowLabel() : null,
                        isOwner ? row.seatNumber() : null)
                : null;
        /* 🔴 **누구에게나** 준다. 꾸밈은 카드의 일부라 사는 사람도 그대로 받는다 (2026-09-23).
           ⚠️ 2026-09-22 에는 isOwner 일 때만 채웠다. 그때는 꾸밈이 만든 사람 것이었다. */
        String decoratedImageUrl = decorationService.imageUrlOf(photocardId);
        return new NftPhotocardDetailResponse(
                row.photocardId(), row.designId(), row.templateId(), row.designName(), row.imageUrl(), row.performanceTitle(),
                row.eventName(), row.ownerNickname(), row.issuedAt(), origin, row.status(), listing, auction,
                row.groupName(), row.grade(), row.averagePrice(), row.viewCount(), isOwner, decoratedImageUrl);
    }

    /**
     * 내가 가진 <b>같은 도안</b>의 카드 전부. 상세 화면의 "총 3장" 목록과 판매할 장 고르기가 쓴다.
     *
     * <p>🔴 <b>도안 ID를 믿지 않는다.</b> 남의 도안 ID를 넣어도 {@code owner_id = :userId} 로
     * 걸러 내 카드만 나온다 — 없으면 빈 목록이다. 404 로 되돌려 주면 "그 도안이 있는지"
     * 를 훑을 수 있게 되므로 굳이 구분하지 않는다.
     *
     * <p>페이지가 없다. 같은 도안을 수십 장 가지는 일은 구조상 없고(도안마다 발행 총량이
     * 정해져 있다), 상세는 "몇 장 가졌나" 를 <b>한 번에</b> 알아야 한다.
     * 상한({@value #DESIGN_COPY_LIMIT})만 걸어 둔다.
     */
    @Transactional(readOnly = true)
    public List<MyDesignPhotocardResponse> getMyPhotocardsOfDesign(Long userId, Long designId) {
        return toCopies(queryRepository.findMyPhotocardsOfDesign(userId, designId, DESIGN_COPY_LIMIT));
    }

    @Transactional(readOnly = true)
    public List<MyDesignPhotocardResponse> getMyPhotocardsOfTemplate(Long userId, Long templateId) {
        return toCopies(queryRepository.findMyPhotocardsOfTemplate(userId, templateId));
    }

    private List<MyDesignPhotocardResponse> toCopies(List<NftMarketQueryRepository.DesignCopyRow> rows) {
        return rows.stream()
                .map(row -> new MyDesignPhotocardResponse(
                        row.photocardId(),
                        row.issuedAt(),
                        /* 내 카드만 나오는 목록이라 좌석 열·번을 가리지 않는다.
                           상세(getPhotocard)에서 가리는 것은 **남의 카드**를 볼 때의 이야기다. */
                        row.areaCode() == null ? null : new NftPhotocardDetailResponse.Origin(
                                row.seatGrade(), row.areaCode(), row.rowLabel(), row.seatNumber()),
                        row.performanceNum(),
                        row.performanceDate(),
                        row.status(),
                        row.marketType() == null ? null
                                : MyNftPhotocardResponse.MarketType.valueOf(row.marketType()),
                        row.marketStatus() == null ? null
                                : MyNftPhotocardResponse.MarketStatus.valueOf(row.marketStatus())))
                .toList();
    }

    @Transactional
    public NftPhotocardViewResponse recordPhotocardView(Long photocardId, Long viewerId, String sessionHeader) {
        // Keep the visibility rule identical to the detail endpoint. A hidden card must not be enumerable.
        getPhotocard(photocardId, viewerId);
        UUID sessionId;
        try {
            sessionId = UUID.fromString(sessionHeader);
        } catch (RuntimeException e) {
            throw new BusinessException(NftErrorCode.INVALID_VIEW_SESSION);
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime bucket = now.withMinute(now.getMinute() < 30 ? 0 : 30).withSecond(0).withNano(0);
        NftMarketQueryRepository.ViewCountRow row =
                queryRepository.recordPhotocardView(photocardId, sessionId, bucket);
        return new NftPhotocardViewResponse(row.viewCount(), row.counted());
    }

    @Transactional
    public NftListingResponse registerListing(Long userId,
                                              Long photocardId,
                                              NftListingCreateRequest request) {
        return registerListing(userId, photocardId, request, ClientRequest.unknown());
    }

    /** @param client 등록 요청을 보낸 단말. 이상거래 심사(판매자·구매자 동일 단말)가 읽는다 */
    @Transactional
    public NftListingResponse registerListing(Long userId,
                                              Long photocardId,
                                              NftListingCreateRequest request,
                                              ClientRequest client) {
        NftPhotocard photocard = getPhotocardForUpdate(photocardId);
        if (!photocard.isOwnedBy(userId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_OWNED);
        }
        if (!photocard.isMinted()) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_MINTED);
        }
        if (listingRepository.existsByPhotocardIdAndStatusIn(
                photocardId, List.of(NftListingStatus.ACTIVE, NftListingStatus.SETTLING))) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_ALREADY_LISTED);
        }
        // 경매 등록도 포카 행 락을 먼저 잡으므로, 여기서 본 결과는 커밋까지 유효하다
        if (auctionRepository.existsByPhotocardIdAndStatusIn(
                photocardId, List.of(NftAuctionStatus.ACTIVE, NftAuctionStatus.SETTLING))) {
            throw new BusinessException(NftErrorCode.AUCTION_ALREADY_ACTIVE);
        }

        NftPhotocardListing listing = NftPhotocardListing.create(
                photocard, photocard.getOwner(), request.price(),
                request.description() == null ? "" : request.description().trim());
        listing.recordClientRequest(client);
        return NftListingResponse.from(listingRepository.save(listing));
    }

    @Transactional
    public void cancelListing(Long userId, Long photocardId) {
        getPhotocardForUpdate(photocardId);
        NftPhotocardListing listing = getActiveListing(photocardId);
        if (!listing.isOwnedBy(userId)) {
            throw new BusinessException(NftErrorCode.LISTING_OWNER_MISMATCH);
        }
        listing.cancel(LocalDateTime.now());
    }

    @Transactional
    public NftPurchaseResponse purchase(Long buyerId, Long photocardId, String idempotencyKeyHeader) {
        return purchase(buyerId, photocardId, idempotencyKeyHeader, ClientRequest.unknown());
    }

    /** @param client 구매 요청을 보낸 단말. 이상거래 심사(판매자·구매자 동일 단말, 계정 탈취)가 읽는다 */
    @Transactional
    public NftPurchaseResponse purchase(Long buyerId, Long photocardId, String idempotencyKeyHeader,
                                        ClientRequest client) {
        UUID idempotencyKey = parseIdempotencyKey(idempotencyKeyHeader);

        // 같은 구매자의 중복 키 요청과, 추후 CAT 계정 차감을 직렬화하기 위한 임시 잠금이다.
        queryRepository.lockPurchaseBuyer(buyerId);
        NftPhotocardTrade existingTrade = tradeRepository
                .findByBuyerIdAndIdempotencyKey(buyerId, idempotencyKey)
                .orElse(null);
        if (existingTrade != null) {
            validateIdempotentTarget(existingTrade, photocardId);
            return NftPurchaseResponse.from(existingTrade);
        }

        NftPhotocard photocard = getPhotocardForUpdate(photocardId);
        // 다른 요청이 포토카드 잠금을 기다리는 동안 거래를 끝냈을 수 있으므로 잠금 뒤 다시 확인한다.
        existingTrade = tradeRepository.findByBuyerIdAndIdempotencyKey(buyerId, idempotencyKey).orElse(null);
        if (existingTrade != null) {
            validateIdempotentTarget(existingTrade, photocardId);
            return NftPurchaseResponse.from(existingTrade);
        }

        NftPhotocardListing listing = listingRepository
                .findByPhotocardIdAndStatus(photocardId, NftListingStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        listingRepository.existsByPhotocardId(photocardId)
                                ? NftErrorCode.LISTING_ALREADY_CLOSED
                                : NftErrorCode.LISTING_NOT_FOUND));
        if (listing.isOwnedBy(buyerId)) {
            throw new BusinessException(NftErrorCode.SELF_PURCHASE_NOT_ALLOWED);
        }

        User buyer = userRepository.findById(buyerId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        NftPhotocardTrade trade = NftPhotocardTrade.pendingListing(listing, buyer, idempotencyKey);
        trade.recordClientRequest(client); // 단말 컬럼은 updatable=false 라 INSERT 전에 채운다
        trade = tradeRepository.saveAndFlush(trade);
        trade.initializeSettlement(CatMoneyHoldRefType.NFT_TRADE_BUYER, trade.getId());
        holdService.hold(buyerId, listing.getPrice(), CatMoneyHoldRefType.NFT_TRADE_BUYER, trade.getId());
        holdService.holdIncoming(listing.getSeller().getId(), listing.getPrice(),
                CatMoneyHoldRefType.NFT_TRADE_SELLER, trade.getId());
        listing.startSettlement();
        return NftPurchaseResponse.from(trade);
    }

    public NftTradeStatusResponse getTradeStatus(Long userId, Long tradeId) {
        NftPhotocardTrade trade = tradeRepository.findById(tradeId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_NOT_FOUND));
        if (!trade.isParticipant(userId)) {
            throw new BusinessException(NftErrorCode.TRADE_ACCESS_DENIED);
        }
        return NftTradeStatusResponse.from(trade);
    }

    public NftCursorPageResponse<NftPurchaseHistoryResponse> getPurchaseHistory(
            Long userId, String cursor, Integer requestedSize) {
        int size = validateSize(requestedSize);
        TimeCursor timeCursor = decodeTimeCursor(cursor, PURCHASE_SCOPE);
        List<NftMarketQueryRepository.UserTradeRow> rows = queryRepository.findPurchaseHistory(
                userId, timeCursor.at(), timeCursor.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.UserTradeRow> pageRows = takePage(rows, size);
        List<NftPurchaseHistoryResponse> items = pageRows.stream()
                .map(row -> new NftPurchaseHistoryResponse(
                        row.tradeId(), row.photocardId(), row.designName(), row.imageUrl(),
                        row.counterpartyNickname(), row.price(), row.tradedAt()))
                .toList();
        return new NftCursorPageResponse<>(items,
                nextTimeCursor(hasNext, PURCHASE_SCOPE, pageRows), hasNext);
    }

    public NftCursorPageResponse<NftSaleHistoryResponse> getSaleHistory(
            Long userId, String cursor, Integer requestedSize) {
        int size = validateSize(requestedSize);
        TimeCursor timeCursor = decodeTimeCursor(cursor, SALE_SCOPE);
        List<NftMarketQueryRepository.UserTradeRow> rows = queryRepository.findSaleHistory(
                userId, timeCursor.at(), timeCursor.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.UserTradeRow> pageRows = takePage(rows, size);
        List<NftSaleHistoryResponse> items = pageRows.stream()
                .map(row -> new NftSaleHistoryResponse(
                        row.tradeId(), row.photocardId(), row.designName(), row.imageUrl(),
                        row.counterpartyNickname(), row.price(), row.tradedAt()))
                .toList();
        return new NftCursorPageResponse<>(items,
                nextTimeCursor(hasNext, SALE_SCOPE, pageRows), hasNext);
    }

    /**
     * 내 포토카드 요약 — 도안별 보유 수와 판매 상태.
     *
     * <p>대표 카드 고르는 규칙은 화면이 갖고 있던 것을 그대로 옮겼다({@code buildPocaDex}).
     * 카드는 최신순으로 오므로 <b>가장 최근 보관 중인 카드</b>가 대표가 되고, 보관 중인 카드가
     * 없으면 가장 최근 카드다. 판매 상태는 마켓에 나간 것 중 가장 최근 한 장의 것이다.
     */
    public MyNftPhotocardSummaryResponse getMyPhotocardSummary(Long userId) {
        OwnedSummary summary = summarizeOwned(userId);
        List<MyNftPhotocardSummaryResponse.Design> designs = summary.byDesign().entrySet().stream()
                .map(e -> new MyNftPhotocardSummaryResponse.Design(
                        e.getKey(), e.getValue().count, e.getValue().marketCount,
                        e.getValue().marketState, e.getValue().photocardId))
                .toList();
        return new MyNftPhotocardSummaryResponse(designs, summary.pendingCount());
    }

    /**
     * 사용자별 도감. 공개된 공연·이벤트 도안을 슬롯으로 깔고 보유 상태를 한 번에 합친다.
     *
     * <p>미보유 슬롯은 ID와 획득처 외의 앞면 정보를 내리지 않는다. 사용자가 가진 도안은 공연이
     * 나중에 비공개로 바뀌어도 수집 기록에서 사라지지 않는다.
     */
    public NftPocaDexResponse getPocaDex(Long userId) {
        OwnedSummary summary = summarizeOwned(userId);
        List<NftPocaDexResponse.Card> cards = pocaDexQueryRepository.findDesigns(userId).stream()
                .map(row -> {
                    DesignTally tally = summary.byDesign().get(row.designId());
                    boolean owned = tally != null;
                    NftPocaDexResponse.Acquisition acquisition = row.performanceId() == null
                            ? new NftPocaDexResponse.Acquisition(
                                    NftPocaDexResponse.AcquisitionType.EVENT, "이벤트 포토카드 팩")
                            : new NftPocaDexResponse.Acquisition(
                                    NftPocaDexResponse.AcquisitionType.PERFORMANCE,
                                    row.performanceTitle());
                    return new NftPocaDexResponse.Card(
                            row.designId(),
                            owned,
                            owned ? row.name() : null,
                            owned ? row.imageUrl() : null,
                            owned ? row.groupName() : null,
                            owned ? row.grade() : null,
                            acquisition,
                            owned ? tally.count : 0,
                            owned ? tally.marketCount : 0,
                            owned ? tally.marketState : null,
                            owned ? tally.photocardId : null);
                })
                .toList();
        return new NftPocaDexResponse(cards, summary.pendingCount());
    }

    private OwnedSummary summarizeOwned(Long userId) {
        List<NftMarketQueryRepository.OwnedStateRow> rows = queryRepository.findOwnedStates(userId);

        Map<Long, DesignTally> byDesign = new LinkedHashMap<>();
        long pending = 0;
        for (NftMarketQueryRepository.OwnedStateRow row : rows) {
            MyNftPhotocardSummaryResponse.MarketState state = marketStateOf(row);
            if (row.status() == NftMintStatus.PENDING || "SETTLING".equals(row.marketStatus())) pending++;

            DesignTally tally = byDesign.computeIfAbsent(row.designId(), id -> new DesignTally(row.photocardId(), state != null));
            tally.count++;
            if (state != null) {
                tally.marketCount++;
                if (tally.marketState == null) tally.marketState = state;
            }
            /* 대표는 보관 중인 카드를 먼저 — 세 장 중 한 장만 올려 둔 사람이 판매 중인 카드 상세로
               떨어지면 거기서 할 일이 "판매 내리기" 뿐이라 남은 두 장을 보러 온 사람에게 막힌 길이다 */
            if (tally.representativeOnMarket && state == null) {
                tally.photocardId = row.photocardId();
                tally.representativeOnMarket = false;
            }
        }
        return new OwnedSummary(byDesign, pending);
    }

    /** 판매 상태 판정 — 화면의 `photocardMarketState` 와 같은 규칙이다 (정산 중 > 경매 > 고정가) */
    private static MyNftPhotocardSummaryResponse.MarketState marketStateOf(
            NftMarketQueryRepository.OwnedStateRow row) {
        if ("SETTLING".equals(row.marketStatus())) return MyNftPhotocardSummaryResponse.MarketState.SETTLING;
        if ("AUCTION".equals(row.marketType())) return MyNftPhotocardSummaryResponse.MarketState.AUCTION;
        if ("FIXED_PRICE".equals(row.marketType())) return MyNftPhotocardSummaryResponse.MarketState.LISTED;
        return null;
    }

    private static final class DesignTally {
        int count;
        int marketCount;
        MyNftPhotocardSummaryResponse.MarketState marketState;
        Long photocardId;
        boolean representativeOnMarket;

        DesignTally(Long photocardId, boolean onMarket) {
            this.photocardId = photocardId;
            this.representativeOnMarket = onMarket;
        }
    }

    private record OwnedSummary(Map<Long, DesignTally> byDesign, long pendingCount) {
    }

    public NftCursorPageResponse<MyNftPhotocardResponse> getMyPhotocards(
            Long userId, Boolean listed, String cursor, Integer requestedSize) {
        int size = validateSize(requestedSize);
        TimeCursor timeCursor = decodeTimeCursor(cursor, OWNED_SCOPE);
        List<NftMarketQueryRepository.OwnedRow> rows = queryRepository.findOwnedPhotocards(
                userId, listed, timeCursor.at(), timeCursor.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.OwnedRow> pageRows = takePage(rows, size);
        /* 🔴 꾸민 그림은 **한 번에** 가져온다. 카드마다 따로 부르면 N+1 이고, 도감이 수십 장이라
           그대로 드러난다. 꾸미지 않은 카드는 맵에 없어 null 이 들어간다. */
        Map<Long, String> decorated = decorationService.imageUrlsOf(
                pageRows.stream().map(NftMarketQueryRepository.OwnedRow::photocardId).toList());
        List<MyNftPhotocardResponse> items = pageRows.stream()
                .map(row -> new MyNftPhotocardResponse(
                        row.photocardId(), row.designId(), row.designName(), row.imageUrl(),
                        row.performanceTitle(), row.eventName(), row.status(), row.listed(),
                        row.marketType() == null ? null
                                : MyNftPhotocardResponse.MarketType.valueOf(row.marketType()),
                        row.marketStatus() == null ? null
                                : MyNftPhotocardResponse.MarketStatus.valueOf(row.marketStatus()),
                        row.groupName(), row.grade(), row.averagePrice(),
                        decorated.get(row.photocardId())))
                .toList();
        String nextCursor = hasNext
                ? cursorCodec.encode(OWNED_SCOPE, pageRows.getLast().createdAt().toString(),
                pageRows.getLast().photocardId())
                : null;
        return new NftCursorPageResponse<>(items, nextCursor, hasNext);
    }

    /**
     * 카드 한 장의 체결 이력.
     *
     * <p>🔴 <b>상세와 같은 자물쇠를 씁니다.</b> 여기 담긴 것은 판매자·구매자 닉네임과 체결가라,
     * 상세만 막고 이쪽을 열어두면 같은 ID 로 같은 사람들을 그대로 긁을 수 있습니다.
     * 존재 확인을 겸해 {@link #getPhotocard} 를 부르므로, 볼 수 없는 카드면 여기서 404 로 끊깁니다.
     */
    public NftCursorPageResponse<NftPhotocardTradeHistoryResponse> getPhotocardTrades(
            Long photocardId, Long viewerId, String cursor, Integer requestedSize) {
        getPhotocard(photocardId, viewerId);
        int size = validateSize(requestedSize);
        TimeCursor timeCursor = decodeTimeCursor(cursor, CARD_TRADE_SCOPE);
        List<NftMarketQueryRepository.CardTradeRow> rows = queryRepository.findPhotocardTrades(
                photocardId, timeCursor.at(), timeCursor.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.CardTradeRow> pageRows = takePage(rows, size);
        List<NftPhotocardTradeHistoryResponse> items = pageRows.stream()
                .map(row -> new NftPhotocardTradeHistoryResponse(
                        row.tradeId(), row.price(), row.sellerNickname(), row.buyerNickname(), row.tradedAt()))
                .toList();
        String nextCursor = hasNext
                ? cursorCodec.encode(CARD_TRADE_SCOPE, pageRows.getLast().tradedAt().toString(),
                pageRows.getLast().tradeId())
                : null;
        return new NftCursorPageResponse<>(items, nextCursor, hasNext);
    }

    @Transactional
    public NftPhotocardIssueResponse issuePhotocards(Long performanceId, NftPhotocardIssueRequest request) {
        if (!queryRepository.lockPerformance(performanceId)) {
            throw new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND);
        }
        // 🔴 C4: existsByDesignPerformanceId(전체) 는 뽑힌 카드(티켓 NULL)도 세어, 그 공연 팩을 한
        // 번만 열어도 수동 발급이 영구히 막힌다. 티켓이 있는 카드로 좁힌다
        if (photocardRepository.existsByDesignPerformanceIdAndTicketIdIsNotNull(performanceId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARDS_ALREADY_ISSUED);
        }

        List<NftDesignAllocationRequest> allocations = request.designAllocations();
        List<Long> designIds = allocations.stream().map(NftDesignAllocationRequest::designId).toList();
        if (new HashSet<>(designIds).size() != designIds.size()) {
            throw new BusinessException(NftErrorCode.DUPLICATE_DESIGN_ALLOCATION);
        }

        List<NftPhotocardDesign> designs = designRepository.findAllByIdForUpdate(designIds);
        if (designs.size() != designIds.size()) {
            throw new BusinessException(NftErrorCode.DESIGN_NOT_FOUND);
        }
        Map<Long, NftPhotocardDesign> designById = new LinkedHashMap<>();
        for (NftPhotocardDesign design : designs) {
            // 🔴 B1: isDrawPool() 을 performanceId 비교보다 먼저 본다. 이벤트 풀 도안(공연 NULL)이
            // 섞이면 아래 equals 에서 NPE(500)가 나고, 뽑기 풀 도안(공연이 있어도)을 그대로 배정하면
            // 티켓 보유자에게 직접 민팅돼 회수 불가 + 그 공연 팩이 뽑을 카드가 사라진다
            if (design.isDrawPool()) {
                throw new BusinessException(NftErrorCode.DESIGN_POOL_CONFLICT);
            }
            if (!design.getPerformanceId().equals(performanceId)) {
                throw new BusinessException(NftErrorCode.DESIGN_PERFORMANCE_MISMATCH);
            }
            designById.put(design.getId(), design);
        }

        requireDesignsRegistered(designById.values());

        List<NftMarketQueryRepository.TicketRecipientRow> recipients =
                queryRepository.findConfirmedTicketRecipients(performanceId);
        int allocationTotal = allocations.stream().mapToInt(NftDesignAllocationRequest::quantity).sum();
        if (allocationTotal != recipients.size()) {
            throw new BusinessException(NftErrorCode.ALLOCATION_QUANTITY_MISMATCH);
        }

        Map<Long, User> usersById = loadRecipients(recipients);
        Map<Long, Long> walletIdByUser = loadRecipientWallets(recipients);

        List<Long> designPool = new ArrayList<>(allocationTotal);
        for (NftDesignAllocationRequest allocation : allocations) {
            NftPhotocardDesign design = designById.get(allocation.designId());
            design.reserve(allocation.quantity());
            for (int i = 0; i < allocation.quantity(); i++) {
                designPool.add(design.getId());
            }
        }
        Collections.shuffle(designPool, SECURE_RANDOM);

        List<NftMarketQueryRepository.IssueRow> issueRows = new ArrayList<>(recipients.size());
        for (int i = 0; i < recipients.size(); i++) {
            NftMarketQueryRepository.TicketRecipientRow recipient = recipients.get(i);
            User owner = usersById.get(recipient.userId());
            issueRows.add(new NftMarketQueryRepository.IssueRow(
                    designPool.get(i), recipient.ticketId(), owner.getId(),
                    walletIdByUser.get(owner.getId())));
        }
        queryRepository.batchIssuePhotocards(issueRows);
        return new NftPhotocardIssueResponse(issueRows.size(), 0);
    }

    /**
     * 회차(performance_detail) 하나에 자동 발급한다. <b>스케줄러 전용</b>이다 —
     * 사람이 넣어 주는 도안별 수량이 없어, 수동 발급({@link #issuePhotocards})과 규칙이 다르다.
     *
     * <ul>
     *   <li><b>회차 단위 중복 방지</b> — 이 회차 티켓으로 카드가 하나라도 만들어졌으면 조용히 끝낸다
     *       (예외 아님). 스케줄러가 매시 다시 도는 것이 정상 경로다.
     *   <li><b>수량 중심 배정</b> — 도안 재고만큼만 발급하고, 재고가 모자라면 일부 수령자는 카드가 없다
     *       ({@link NftPhotocardScheduleAllocator}).
     *   <li><b>거를 것은 거르고 진행</b> — 지갑·회원 정보가 없는 수령자, 온체인 미등록 도안은 대상에서
     *       빼고 나머지로 발급한다. 수동 발급의 "한 명이라도 없으면 전체 롤백" 과 반대다 —
     *       스케줄러는 사람이 지켜보지 않아, 한 건이 전체를 멈추게 두면 안 된다.
     * </ul>
     *
     * <p>체인 전송은 여기서 하지 않는다. 카드 행만 PENDING 으로 만들고, 전송은
     * {@code NftPhotocardMinter.mintPendingForSchedule} 이 트랜잭션 밖에서 이어 한다.
     */
    @Transactional
    public NftPhotocardIssueResponse issuePhotocardsForSchedule(Long scheduleId) {
        if (!queryRepository.lockSchedule(scheduleId)) {
            throw new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND);
        }
        if (queryRepository.existsPhotocardForSchedule(scheduleId)) {
            return new NftPhotocardIssueResponse(0, 0);
        }
        Long performanceId = queryRepository.findPerformanceIdBySchedule(scheduleId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND));

        // 🔴 draw_pool 도안은 배정 대상이 아니다 — 그건 그 공연 카드팩이 뽑을 재고다.
        // 여기서 잡으면 티켓 보유자에게 직접 발급되어 팩에서 뽑을 카드가 사라진다
        List<NftPhotocardDesign> allDesigns =
                designRepository.findAllByPerformanceIdAndDrawPoolFalseOrderByIdAsc(performanceId);
        if (allDesigns.isEmpty()) {
            log.info("회차 자동 발급 건너뜀 — 공연에 도안이 없습니다 scheduleId={} performanceId={}",
                    scheduleId, performanceId);
            return new NftPhotocardIssueResponse(0, 0);
        }
        // 배정하며 issued_supply 를 누적 갱신하므로 잠그고 읽는다. 잠근 뒤 상태를 다시 본다
        List<NftPhotocardDesign> designs = designRepository.findAllByIdForUpdate(
                        allDesigns.stream().map(NftPhotocardDesign::getId).toList()).stream()
                .filter(NftPhotocardDesign::isRegistered)
                .toList();
        if (designs.isEmpty()) {
            log.info("회차 자동 발급 건너뜀 — 온체인 등록된 도안이 없습니다 scheduleId={} performanceId={}",
                    scheduleId, performanceId);
            return new NftPhotocardIssueResponse(0, 0);
        }

        List<NftMarketQueryRepository.TicketRecipientRow> recipients =
                queryRepository.findConfirmedTicketRecipientsForSchedule(scheduleId);
        if (recipients.isEmpty()) {
            return new NftPhotocardIssueResponse(0, 0);
        }

        List<Long> userIds = recipients.stream()
                .map(NftMarketQueryRepository.TicketRecipientRow::userId).distinct().toList();
        Map<Long, User> usersById = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> usersById.put(user.getId(), user));
        Map<Long, Long> walletIdByUser = queryRepository
                .findActiveWallets(userIds, blockchainProperties.chainId()).stream()
                .collect(Collectors.toMap(
                        NftMarketQueryRepository.UserWalletRow::userId,
                        NftMarketQueryRepository.UserWalletRow::walletId));

        List<NftMarketQueryRepository.TicketRecipientRow> eligible = recipients.stream()
                .filter(row -> usersById.containsKey(row.userId()) && walletIdByUser.containsKey(row.userId()))
                .collect(Collectors.toCollection(ArrayList::new));
        if (eligible.size() < recipients.size()) {
            log.warn("회차 자동 발급 — 지갑/회원 정보가 없는 수령자 {}명 제외 scheduleId={}",
                    recipients.size() - eligible.size(), scheduleId);
        }
        if (eligible.isEmpty()) {
            return new NftPhotocardIssueResponse(0, 0);
        }

        int[] remaining = designs.stream()
                .mapToInt(design -> design.getTotalSupply() - design.getIssuedSupply())
                .toArray();
        int[] quantities = NftPhotocardScheduleAllocator.allocate(remaining, eligible.size());

        List<Long> designPool = new ArrayList<>();
        for (int i = 0; i < designs.size(); i++) {
            if (quantities[i] <= 0) {
                continue;
            }
            NftPhotocardDesign design = designs.get(i);
            design.reserve(quantities[i]);
            for (int n = 0; n < quantities[i]; n++) {
                designPool.add(design.getId());
            }
        }
        if (designPool.isEmpty()) {
            log.info("회차 자동 발급 건너뜀 — 도안 재고가 없습니다 scheduleId={} performanceId={}",
                    scheduleId, performanceId);
            return new NftPhotocardIssueResponse(0, 0);
        }

        Collections.shuffle(designPool, SECURE_RANDOM);
        Collections.shuffle(eligible, SECURE_RANDOM);

        List<NftMarketQueryRepository.IssueRow> issueRows = new ArrayList<>(designPool.size());
        for (int i = 0; i < designPool.size(); i++) {
            NftMarketQueryRepository.TicketRecipientRow recipient = eligible.get(i);
            issueRows.add(new NftMarketQueryRepository.IssueRow(
                    designPool.get(i), recipient.ticketId(), recipient.userId(),
                    walletIdByUser.get(recipient.userId())));
        }
        queryRepository.batchIssuePhotocards(issueRows);
        log.info("회차 자동 발급 scheduleId={} 확정 티켓 {}명 중 {}장 발급",
                scheduleId, recipients.size(), issueRows.size());
        return new NftPhotocardIssueResponse(issueRows.size(), 0);
    }

    /**
     * 배정된 도안이 전부 온체인에 등록됐는지.
     *
     * <p><b>미등록 도안이 하나라도 섞이면 발행 배치 전체가 revert 된다.</b> 200장을 보내고
     * 10초 뒤에 통째로 실패한 걸 알게 되는 것보다, 여기서 막는 편이 낫다.
     * (blockchain/PHOTOCARD_PLAN.md 2장)
     */
    private void requireDesignsRegistered(Collection<NftPhotocardDesign> designs) {
        for (NftPhotocardDesign design : designs) {
            if (!design.isRegistered()) {
                throw new BusinessException(NftErrorCode.DESIGN_NOT_REGISTERED_ON_CHAIN);
            }
        }
    }

    /**
     * 받는 사람들의 지갑. <b>한 명이라도 없으면 발급 전체를 거절한다.</b>
     *
     * <p>지갑이 없으면 보낼 주소가 없어 그 카드만 체인에 못 올라간다. 그대로 두면 카드가
     * 절반만 나간 공연이 생기고, 수습 비용이 발급을 다시 하는 것보다 훨씬 크다.
     * 탈퇴 회원이 섞였을 때 전체를 롤백하는 것과 같은 태도다.
     */
    private Map<Long, Long> loadRecipientWallets(
            List<NftMarketQueryRepository.TicketRecipientRow> recipients) {
        List<Long> userIds = recipients.stream()
                .map(NftMarketQueryRepository.TicketRecipientRow::userId)
                .distinct()
                .toList();

        Map<Long, Long> walletIdByUser = queryRepository
                .findActiveWallets(userIds, blockchainProperties.chainId()).stream()
                .collect(Collectors.toMap(
                        NftMarketQueryRepository.UserWalletRow::userId,
                        NftMarketQueryRepository.UserWalletRow::walletId));

        if (walletIdByUser.size() != userIds.size()) {
            throw new BusinessException(NftErrorCode.RECIPIENT_WALLET_NOT_FOUND);
        }

        return walletIdByUser;
    }

    private NftPhotocard getPhotocardForUpdate(Long photocardId) {
        return photocardRepository.findByIdForUpdate(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
    }

    private NftPhotocardListing getActiveListing(Long photocardId) {
        return listingRepository.findByPhotocardIdAndStatus(photocardId, NftListingStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(NftErrorCode.LISTING_NOT_FOUND));
    }

    private Map<Long, User> loadRecipients(List<NftMarketQueryRepository.TicketRecipientRow> recipients) {
        List<Long> userIds = recipients.stream()
                .map(NftMarketQueryRepository.TicketRecipientRow::userId)
                .distinct()
                .toList();
        Map<Long, User> usersById = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> usersById.put(user.getId(), user));
        if (usersById.size() != userIds.size()) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_OWNER_NOT_FOUND);
        }
        return usersById;
    }

    private UUID parseIdempotencyKey(String header) {
        return NftRequestSupport.parseIdempotencyKey(header);
    }

    private void validateIdempotentTarget(NftPhotocardTrade trade, Long photocardId) {
        if (!trade.getPhotocard().getId().equals(photocardId)) {
            throw new BusinessException(NftErrorCode.IDEMPOTENCY_KEY_REUSED);
        }
    }

    private int validateSize(Integer requestedSize) {
        return NftRequestSupport.validateSize(requestedSize);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim();
    }

    private String marketCursor(NftMarketSort sort, NftMarketQueryRepository.MarketRow row) {
        String value = switch (sort) {
            case RECENT -> row.listedAt().toString();
            case VIEW_DESC -> Long.toString(row.viewCount());
            default -> row.price().toString();
        };
        return cursorCodec.encode(MARKET_SCOPE_PREFIX + sort.name(), value, row.listingId());
    }

    private void validateMarketCursor(NftCursorCodec.Cursor cursor, NftMarketSort sort) {
        if (!cursor.present()) {
            return;
        }
        try {
            if (sort == NftMarketSort.RECENT) {
                LocalDateTime.parse(cursor.value());
            } else {
                Long.parseLong(cursor.value());
            }
        } catch (RuntimeException e) {
            throw new BusinessException(NftErrorCode.INVALID_CURSOR);
        }
    }

    private TimeCursor decodeTimeCursor(String cursor, String scope) {
        NftCursorCodec.Cursor decoded = cursorCodec.decode(cursor, scope);
        if (!decoded.present()) {
            return new TimeCursor(null, null);
        }
        try {
            return new TimeCursor(LocalDateTime.parse(decoded.value()), decoded.id());
        } catch (RuntimeException e) {
            throw new BusinessException(NftErrorCode.INVALID_CURSOR);
        }
    }

    private String nextTimeCursor(boolean hasNext,
                                  String scope,
                                  List<NftMarketQueryRepository.UserTradeRow> rows) {
        if (!hasNext) {
            return null;
        }
        NftMarketQueryRepository.UserTradeRow last = rows.getLast();
        return cursorCodec.encode(scope, last.tradedAt().toString(), last.tradeId());
    }

    private <T> List<T> takePage(List<T> rows, int size) {
        return rows.size() > size ? List.copyOf(rows.subList(0, size)) : List.copyOf(rows);
    }

    private record TimeCursor(LocalDateTime at, Long id) {
    }
}
