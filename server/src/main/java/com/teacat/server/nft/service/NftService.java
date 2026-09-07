package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftDesignAllocationRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.MyNftPhotocardResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftListingResponse;
import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDetailResponse;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.dto.response.NftPhotocardTradeHistoryResponse;
import com.teacat.server.nft.dto.response.NftPurchaseHistoryResponse;
import com.teacat.server.nft.dto.response.NftPurchaseResponse;
import com.teacat.server.nft.dto.response.NftSaleHistoryResponse;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardListing;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.repository.NftPhotocardListingRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NftService {

    private static final String MARKET_SCOPE_PREFIX = "market:";
    private static final String PURCHASE_SCOPE = "purchases";
    private static final String SALE_SCOPE = "sales";
    private static final String OWNED_SCOPE = "owned";
    private static final String CARD_TRADE_SCOPE = "card-trades";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final NftPhotocardRepository photocardRepository;
    private final NftAuctionRepository auctionRepository;
    private final NftPhotocardDesignRepository designRepository;
    private final NftPhotocardListingRepository listingRepository;
    private final NftPhotocardTradeRepository tradeRepository;
    private final NftMarketQueryRepository queryRepository;
    private final UserRepository userRepository;
    private final NftCursorCodec cursorCodec;

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
        List<NftMarketPhotocardResponse> items = pageRows.stream()
                .map(row -> new NftMarketPhotocardResponse(
                        row.photocardId(), row.listingId(), row.designName(), row.imageUrl(),
                        row.performanceTitle(), row.price(), row.sellerNickname()))
                .toList();
        String nextCursor = hasNext ? marketCursor(effectiveSort, pageRows.getLast()) : null;
        return new NftCursorPageResponse<>(items, nextCursor, hasNext);
    }

    public NftPhotocardDetailResponse getPhotocard(Long photocardId) {
        NftMarketQueryRepository.DetailRow row = queryRepository.findPhotocardDetail(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        NftPhotocardDetailResponse.Listing listing = row.listingId() == null ? null
                : new NftPhotocardDetailResponse.Listing(
                        row.listingId(), row.price(), row.sellerDescription(), row.listedAt());
        NftPhotocardDetailResponse.Origin origin = new NftPhotocardDetailResponse.Origin(
                row.seatGrade(), row.areaCode(), row.rowLabel(), row.seatNumber());
        return new NftPhotocardDetailResponse(
                row.photocardId(), row.designName(), row.imageUrl(), row.performanceTitle(),
                row.ownerNickname(), row.issuedAt(), origin, row.status(), listing);
    }

    @Transactional
    public NftListingResponse registerListing(Long userId,
                                              Long photocardId,
                                              NftListingCreateRequest request) {
        NftPhotocard photocard = getPhotocardForUpdate(photocardId);
        if (!photocard.isOwnedBy(userId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_OWNED);
        }
        if (listingRepository.existsByPhotocardIdAndStatus(photocardId, NftListingStatus.ACTIVE)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_ALREADY_LISTED);
        }
        // 경매 등록도 포카 행 락을 먼저 잡으므로, 여기서 본 결과는 커밋까지 유효하다
        if (auctionRepository.existsByPhotocardIdAndStatus(photocardId, NftAuctionStatus.ACTIVE)) {
            throw new BusinessException(NftErrorCode.AUCTION_ALREADY_ACTIVE);
        }

        NftPhotocardListing listing = listingRepository.save(
                NftPhotocardListing.create(
                        photocard, photocard.getOwner(), request.price(), request.description().trim()));
        return NftListingResponse.from(listing);
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

        // TODO(cat-money): CAT 도메인 확정 후 이 위치에서 구매자 차감과 판매자 지급을 수행한다.
        // 이 연동 전에는 무료 소유권 이전이 되므로 구매 API를 운영 환경에 노출하면 안 된다.
        LocalDateTime now = LocalDateTime.now();
        listing.sold(now);
        photocard.transferTo(buyer);
        NftPhotocardTrade trade = tradeRepository.saveAndFlush(
                NftPhotocardTrade.complete(listing, buyer, idempotencyKey));
        return NftPurchaseResponse.from(trade);
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

    public NftCursorPageResponse<MyNftPhotocardResponse> getMyPhotocards(
            Long userId, Boolean listed, String cursor, Integer requestedSize) {
        int size = validateSize(requestedSize);
        TimeCursor timeCursor = decodeTimeCursor(cursor, OWNED_SCOPE);
        List<NftMarketQueryRepository.OwnedRow> rows = queryRepository.findOwnedPhotocards(
                userId, listed, timeCursor.at(), timeCursor.id(), size + 1);
        boolean hasNext = rows.size() > size;
        List<NftMarketQueryRepository.OwnedRow> pageRows = takePage(rows, size);
        List<MyNftPhotocardResponse> items = pageRows.stream()
                .map(row -> new MyNftPhotocardResponse(
                        row.photocardId(), row.designName(), row.imageUrl(), row.performanceTitle(),
                        row.status(), row.listed()))
                .toList();
        String nextCursor = hasNext
                ? cursorCodec.encode(OWNED_SCOPE, pageRows.getLast().createdAt().toString(),
                pageRows.getLast().photocardId())
                : null;
        return new NftCursorPageResponse<>(items, nextCursor, hasNext);
    }

    public NftCursorPageResponse<NftPhotocardTradeHistoryResponse> getPhotocardTrades(
            Long photocardId, String cursor, Integer requestedSize) {
        getPhotocard(photocardId);
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
        if (photocardRepository.existsByDesignPerformanceId(performanceId)) {
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
            if (!design.getPerformanceId().equals(performanceId)) {
                throw new BusinessException(NftErrorCode.DESIGN_PERFORMANCE_MISMATCH);
            }
            designById.put(design.getId(), design);
        }

        List<NftMarketQueryRepository.TicketRecipientRow> recipients =
                queryRepository.findConfirmedTicketRecipients(performanceId);
        int allocationTotal = allocations.stream().mapToInt(NftDesignAllocationRequest::quantity).sum();
        if (allocationTotal != recipients.size()) {
            throw new BusinessException(NftErrorCode.ALLOCATION_QUANTITY_MISMATCH);
        }

        Map<Long, User> usersById = loadRecipients(recipients);
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
                    designPool.get(i), recipient.ticketId(), owner.getId()));
        }
        queryRepository.batchIssuePhotocards(issueRows);
        return new NftPhotocardIssueResponse(issueRows.size(), 0);
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
        String value = sort == NftMarketSort.RECENT ? row.listedAt().toString() : row.price().toString();
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
