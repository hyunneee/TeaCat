package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.dto.request.NftDecorationSaveRequest;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardDecorationRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 포카 꾸미기 — 남의 그림이 새지 않는가.
 *
 * <p>🔴 이 테스트가 지키는 것은 <b>두 가지가 서로 다른 장치</b>라는 점이다:
 * <ul>
 *   <li><b>유출 방지</b> — 꾸밈 조회가 언제나 {@code user_id} 로 함께 거른다.
 *       이것 때문에 주인이 바뀌어도 새 주인에게 안 보인다.</li>
 *   <li><b>저장공간 정리</b> — 실제로 팔릴 때 판 사람의 행과 MinIO 객체를 지운다.</li>
 * </ul>
 * 앞의 것이 깨지면 남의 그림이 노출되고, 뒤의 것이 깨지면 쓰레기가 쌓인다. 증상이 다르므로
 * 따로 확인한다.
 *
 * <p>🔴 <b>판매 "등록" 과 "팔림" 은 다르다.</b> 등록은 소유자를 바꾸지 않으므로 꾸밈이 그대로
 * 남아야 한다 — 안 팔리고 돌아왔을 때 사용자가 꾸민 것을 잃지 않는다.
 */
class PhotocardDecorationIntegrationTests extends PostgresIntegrationTest {

    /** 1×1 투명 PNG. 서비스는 base64 디코드와 크기만 보므로 내용은 상관없다 */
    private static final String TINY_PNG =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    @Autowired private NftDecorationService decorationService;
    @Autowired private NftService nftService;
    @Autowired private NftTradeSettlementWriter settlementWriter;
    @Autowired private NftPhotocardDecorationRepository decorationRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    /** 🔴 MinIO 는 띄우지 않는다. 올리고 지우는 "호출" 만 확인하면 되는 시험이다 */
    @MockitoBean private FileStorageService fileStorageService;

    @BeforeEach
    void stubStorage() {
        when(fileStorageService.uploadBytes(any(), anyString(), anyString()))
                .thenReturn("photocard/decoration/" + UUID.randomUUID() + ".png");
        when(fileStorageService.presignedUrl(anyString())).thenReturn("https://example.test/signed.png");
    }

    private NftDecorationSaveRequest request() {
        return new NftDecorationSaveRequest(TINY_PNG, "[{\"id\":\"a\",\"stickerId\":1}]");
    }

    private void insertListing(Long photocardId, Long sellerId, Long price) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_listings
                    (photocard_id, seller_id, price, description, status)
                VALUES (?, ?, ?, '테스트 판매 설명', 'ACTIVE')
                """, photocardId, sellerId, price);
    }

    // ───────────────────────── 저장·덮어쓰기·소유

    @Test
    void 다시_꾸미면_행이_늘지_않고_덮어쓴다() {
        Long userId = insertUser("deco1@test.com", "꾸미는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);

        decorationService.save(userId, photocardId, request());
        decorationService.save(userId, photocardId, request());

        assertThat(decorationRepository.findAll()).hasSize(1);
    }

    /** 🔴 안 지우면 다시 꾸밀 때마다 안 쓰는 이미지가 한 장씩 쌓인다 */
    @Test
    void 덮어쓸_때_예전_이미지를_지운다() {
        Long userId = insertUser("deco2@test.com", "덮어쓰는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);

        decorationService.save(userId, photocardId, request());
        String firstKey = decorationRepository.findByPhotocardIdAndUserId(photocardId, userId)
                .orElseThrow().getImageKey();
        decorationService.save(userId, photocardId, request());

        verify(fileStorageService).delete(firstKey);
    }

    @Test
    void 남의_카드는_꾸밀_수_없다() {
        Long ownerId = insertUser("owner@test.com", "주인");
        Long strangerId = insertUser("stranger@test.com", "남");
        Long photocardId = insertPhotocardOwnedBy(ownerId);

        assertThatThrownBy(() -> decorationService.save(strangerId, photocardId, request()))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.PHOTOCARD_NOT_OWNED));
    }

    @Test
    void 꾸민_적이_없으면_조회가_404다() {
        Long userId = insertUser("deco3@test.com", "안꾸민사람");
        Long photocardId = insertPhotocardOwnedBy(userId);

        assertThatThrownBy(() -> decorationService.find(userId, photocardId))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_NOT_FOUND));
    }

    // ───────────────────────── 판매 등록은 꾸밈을 건드리지 않는다

    /** 🔴 등록은 소유자를 안 바꾼다. 안 팔리고 돌아오면 꾸민 것이 그대로 있어야 한다 */
    @Test
    void 판매_등록만_해서는_꾸밈이_사라지지_않는다() {
        Long sellerId = insertUser("listing@test.com", "등록만한사람");
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "등록 테스트 카드", 1),
                insertTicket(sellerId, fixture), sellerId);

        decorationService.save(sellerId, photocardId, request());
        insertListing(photocardId, sellerId, 3_000L);

        assertThat(decorationRepository.findByPhotocardIdAndUserId(photocardId, sellerId)).isPresent();
    }

    // ───────────────────────── 실제로 팔렸을 때

    @Test
    void 정산이_끝나면_판_사람의_꾸밈이_사라진다() {
        /* 🔴 거래를 타는 시험은 **지갑과 잔액이 있어야** 한다 — insertUser 만 쓰면
           purchase 가 "지갑이 없습니다" 로 끊긴다 (실제로 한 번 걸렸다). */
        Long sellerId = insertFundedUser("seller-deco@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("buyer-deco@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "정산 테스트 카드", 1),
                insertTicket(sellerId, fixture), sellerId);
        decorationService.save(sellerId, photocardId, request());
        insertListing(photocardId, sellerId, 3_000L);

        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
        settlementWriter.catConfirmed(trade.tradeId());
        settlementWriter.nftSubmitted(trade.tradeId(), null);
        settlementWriter.complete(trade.tradeId());

        assertThat(decorationRepository.findByPhotocardIdAndUserId(photocardId, sellerId)).isEmpty();
    }

    /**
     * 🔴 <b>유출을 막는 건 조회의 {@code user_id} 조건이다.</b> 삭제가 빠져도 이건 통과해야 한다 —
     * 두 장치를 따로 확인하려고 나눠 둔 시험이다.
     */
    @Test
    void 주인이_바뀌면_새_주인에게는_예전_꾸밈이_안_보인다() {
        Long sellerId = insertFundedUser("seller-leak@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("buyer-leak@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "유출 테스트 카드", 1),
                insertTicket(sellerId, fixture), sellerId);
        decorationService.save(sellerId, photocardId, request());
        insertListing(photocardId, sellerId, 3_000L);

        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
        settlementWriter.catConfirmed(trade.tradeId());
        settlementWriter.nftSubmitted(trade.tradeId(), null);
        settlementWriter.complete(trade.tradeId());

        assertThat(decorationService.imageUrlsOf(buyerId, java.util.List.of(photocardId))).isEmpty();
        assertThat(nftService.getMyPhotocards(buyerId, null, null, 20).items())
                .singleElement()
                .satisfies(card -> assertThat(card.decoratedImageUrl()).isNull());
    }

    /**
     * 🔴 UNIQUE 가 {@code photocard_id} 한 칸이었다면 여기서 막힌다 — 남의 행이 자리를
     * 차지해 <b>새 주인이 자기 카드를 영영 못 꾸민다.</b> 제약이 두 칸인지 지키는 시험이다.
     */
    @Test
    void 새_주인도_그_카드를_꾸밀_수_있다() {
        Long sellerId = insertFundedUser("seller-new@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("buyer-new@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "새주인 테스트 카드", 1),
                insertTicket(sellerId, fixture), sellerId);
        decorationService.save(sellerId, photocardId, request());
        insertListing(photocardId, sellerId, 3_000L);

        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
        settlementWriter.catConfirmed(trade.tradeId());
        settlementWriter.nftSubmitted(trade.tradeId(), null);
        settlementWriter.complete(trade.tradeId());

        decorationService.save(buyerId, photocardId, request());

        assertThat(decorationRepository.findByPhotocardIdAndUserId(photocardId, buyerId)).isPresent();
    }
}
