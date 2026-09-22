package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.response.NftAdminAuctionDetailResponse;
import com.teacat.server.nft.dto.response.NftAdminAuctionPageResponse;
import com.teacat.server.nft.dto.response.NftAdminAuctionResponse;
import com.teacat.server.nft.dto.response.NftAuctionBidHistoryResponse;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionBid;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 어드민의 경매 관리 — <b>보기</b>와 <b>강제 취소</b>.
 *
 * <p>사용자용 {@link NftAuctionService} 와 나누는 이유는 판정 기준이 다르기 때문이다.
 * 저쪽은 "내 것인가" 를 먼저 묻고 여기는 묻지 않는다. 한 서비스에 섞으면 소유자 검사를
 * 건너뛰는 분기가 사용자 경로 옆에 놓이게 되고, 그건 언젠가 잘못 재사용된다.
 *
 * <p>권한은 {@code SecurityConfig} 의 {@code /admin/**} 가 ADMIN 으로 막는다 —
 * 서비스에서 다시 검사하지 않는다(다른 어드민 서비스와 같은 규율).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NftAuctionAdminService {

    /** 한 페이지 최대 건수. 화면이 큰 수를 보내도 서버가 잘라 낸다 */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * 상세에 함께 담는 입찰 이력 상한.
     *
     * <p>경매 하나에 입찰이 수천 건 붙을 수 있고(마감 직전 연타), 그걸 다 담으면 어드민
     * 화면이 응답을 받다가 멈춘다. 이상거래를 알아보는 데 필요한 것은 <b>최근 흐름</b>이라
     * 최신부터 자른다.
     */
    static final int BID_LIMIT = 200;

    private final NftAuctionRepository auctionRepository;
    private final NftAuctionQueryRepository queryRepository;
    private final CatMoneyHoldService holdService;

    /**
     * 경매 목록. {@code status} 가 null 이면 전체, {@code keyword} 는 도안명·공연명·판매자 닉네임.
     *
     * <p>🔴 목록과 건수를 <b>한 트랜잭션</b>에서 읽는다. 갈라 읽으면 그사이 새 경매가 들어와
     * "37건" 이라 써 놓고 마지막 페이지가 비는 일이 생긴다.
     */
    @Transactional(readOnly = true)
    public NftAdminAuctionPageResponse list(NftAuctionStatus status, String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        String safeKeyword = keyword == null || keyword.isBlank() ? null : keyword.trim();

        /* 🔴 취소 가능 판정의 기준 시각은 **DB 시계**다. 서버 JVM 시계로 판정하면
           마감 직전 경매에서 화면의 버튼과 서버의 거절이 서로 어긋난다. */
        LocalDateTime now = queryRepository.currentTime();
        long total = queryRepository.countAuctionsForAdmin(status, safeKeyword);
        List<NftAdminAuctionResponse> auctions = queryRepository
                .findAuctionsForAdmin(status, safeKeyword, safePage * safeSize, safeSize)
                .stream()
                .map(row -> NftAdminAuctionResponse.of(row, now))
                .toList();

        return NftAdminAuctionPageResponse.of(auctions, safePage, safeSize, total);
    }

    @Transactional(readOnly = true)
    public NftAdminAuctionDetailResponse get(Long auctionId) {
        NftAuctionQueryRepository.AuctionDetailRow row = queryRepository.findAuctionDetail(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));
        LocalDateTime now = queryRepository.currentTime();

        /* 🔴 상세를 보는 것만으로 만료된 경매를 닫지 않는다. 사용자용 상세는 지연 마감을
           하지만, 어드민이 들여다보는 행위가 상태를 바꾸면 "내가 본 순간 낙찰됐다" 가 된다.
           마감은 스위퍼의 몫이고 어드민 화면은 있는 그대로 보여준다. */
        List<NftAuctionBidHistoryResponse> bids = queryRepository.findBids(auctionId, null, BID_LIMIT)
                .stream()
                .map(bid -> new NftAuctionBidHistoryResponse(
                        bid.bidId(), bid.bidderNickname(), bid.amount(), bid.bidAt()))
                .toList();

        return new NftAdminAuctionDetailResponse(
                NftAdminAuctionResponse.of(toListRow(row), now),
                row.sellerId(),
                row.topBidderId(),
                row.topBidderNickname(),
                bids);
    }

    /**
     * 강제 취소. 판매자 취소와 달리 <b>입찰이 붙은 경매도</b> 돌린다.
     *
     * <p>판매자 취소({@link NftAuctionService#cancelAuction})는 입찰이 하나라도 있으면
     * 거절한다. 그래서 지금까지는 부정 입찰·사칭 신고가 들어와도 되돌릴 방법이 없었다.
     *
     * <p>🔴 <b>진행 중이고 마감 시각이 지나지 않은 경매만</b> 취소한다.
     *    마감 시각이 지난 경매는 스위퍼가 곧 낙찰로 닫을 것이고, 그 틈에 취소하면
     *    정당한 낙찰자의 낙찰을 빼앗는 것이 된다. 정산이 시작된 뒤(SETTLING)는 체인에
     *    이미 뭔가 나갔을 수 있어 <b>거래 심사</b>가 다룰 일이다.
     *
     * <p>🔴 담보를 푸는 것을 잊으면 입찰자의 캣머니가 영구히 묶인다. 최고 입찰 <b>한 건만</b>
     *    홀드를 갖는다 — 새 입찰이 들어올 때 이전 최고가의 홀드를 그때그때 풀기 때문이다
     *    ({@link NftAuctionService#placeBid}).
     *
     * <p>⚠️ 사유는 로그에만 남는다(사용자 결정). DB 열이 없으므로 지나간 취소 이유는
     *    화면에서 되돌려 볼 수 없다.
     */
    @Transactional
    public void forceCancel(Long adminId, Long auctionId, String reason) {
        NftAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.AUCTION_NOT_FOUND));

        if (!auction.isActive()) {
            throw new BusinessException(NftErrorCode.AUCTION_NOT_ACTIVE);
        }
        if (!auction.getEndsAt().isAfter(queryRepository.currentTime())) {
            throw new BusinessException(NftErrorCode.AUCTION_CLOSING);
        }

        NftAuctionBid topBid = auction.getTopBid();
        if (topBid != null) {
            holdService.release(CatMoneyHoldRefType.AUCTION_BID, topBid.getId());
        }
        auction.cancel(LocalDateTime.now());

        /* 🔴 되돌릴 수 없는 동작이라 남길 것을 다 남긴다 — 누가, 어느 경매를, 누구의 담보
           얼마를 풀었는지. 닉네임·이메일은 적지 않는다(server/CLAUDE.md 6장). */
        log.info("경매 강제 취소 adminId={} auctionId={} bidCount={} releasedBidId={} releasedAmount={} reason={}",
                adminId, auctionId, auction.getBidCount(),
                topBid == null ? null : topBid.getId(),
                topBid == null ? null : topBid.getAmount(),
                reason);
    }

    /**
     * 상세 행을 목록 행으로 옮긴다 — 목록 DTO 를 그대로 재사용하기 위해서다.
     *
     * <p>🔴 상세 쿼리에는 {@code imageUrl}·{@code closedAt} 까지 다 들어 있으므로 빠지는
     * 값이 없다. 없는 값을 null 로 채우게 되면 그때는 DTO 를 나눠야 한다.
     */
    private NftAuctionQueryRepository.AuctionRow toListRow(NftAuctionQueryRepository.AuctionDetailRow row) {
        return new NftAuctionQueryRepository.AuctionRow(
                row.auctionId(), row.photocardId(), row.designName(), row.imageUrl(),
                row.performanceTitle(), row.sellerNickname(), row.startPrice(), row.currentPrice(),
                row.buyNowPrice(), row.bidCount(), row.endsAt(), row.createdAt(),
                row.status(), row.closedAt(), row.winnerNickname());
    }
}
