package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.dto.request.NftDecorationSaveRequest;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardDecorationRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 포카 꾸미기 — <b>꾸밈은 카드의 일부이고, 스티커는 붙이면 못 뗀다.</b>
 *
 * <p>🔴 <b>2026-09-22 의 테스트를 뒤집은 것이다.</b> 그때는 꾸밈이 만든 사람 것이어서
 * "새 주인에게 안 보인다 / 팔리면 사라진다" 를 지켰다. 2026-09-23 에 마켓에도 꾸민 모습을
 * 보여주기로 하면서 반대가 됐다 — <b>보여준 것과 받는 것이 달라지면 사는 사람이 속는다.</b>
 *
 * <p>그래서 이 파일이 지키는 것은 정반대다: <b>주인이 바뀌어도 남아 있고, 새 주인에게 보인다.</b>
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

    /** 🔴 MinIO 는 띄우지 않는다. 올리고 지우는 "호출" 만 보면 되는 시험이다 */
    @MockitoBean private FileStorageService fileStorageService;

    @BeforeEach
    void stubStorage() {
        when(fileStorageService.uploadPublicBytes(any(), anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1) + "/" + UUID.randomUUID() + ".png");
        when(fileStorageService.presignedUrl(anyString())).thenReturn("https://example.test/signed.png");
        when(fileStorageService.publicObjectUrl(anyString()))
                .thenAnswer(inv -> "https://example.test/public/" + inv.getArgument(0));
    }

    // ───────────────────────── 픽스처

    private Long insertSticker(Long userId) {
        Long jobId = jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed)
                VALUES (?, 'DONE', ?, 'sticker/sketch/a.png', 1)
                RETURNING id
                """, Long.class, userId, UUID.randomUUID().toString());
        return jdbcTemplate.queryForObject("""
                INSERT INTO stickers (job_id, user_id, image_key)
                VALUES (?, ?, 'sticker/result/a.png')
                RETURNING id
                """, Long.class, jobId, userId);
    }

    private boolean isStickerUsed(Long stickerId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT used_at IS NOT NULL FROM stickers WHERE id = ?", Boolean.class, stickerId));
    }

    /** 배치 JSON — 서버는 stickerId 만 읽는다 */
    private String placements(Long... stickerIds) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < stickerIds.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"id\":\"p").append(i).append("\",\"stickerId\":").append(stickerIds[i])
              .append(",\"x\":0.5,\"y\":0.5,\"scale\":0.3,\"rotation\":0}");
        }
        return sb.append(']').toString();
    }

    private NftDecorationSaveRequest request(Long... stickerIds) {
        return new NftDecorationSaveRequest(TINY_PNG, placements(stickerIds));
    }

    private void insertListing(Long photocardId, Long sellerId, Long price) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_listings
                    (photocard_id, seller_id, price, description, status)
                VALUES (?, ?, ?, '테스트 판매 설명', 'ACTIVE')
                """, photocardId, sellerId, price);
    }

    /** 팔릴 때까지 태운다 — 세 테스트가 같은 흐름을 쓴다 */
    private void sell(Long buyerId, Long photocardId) {
        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
        settlementWriter.catConfirmed(trade.tradeId());
        settlementWriter.nftSubmitted(trade.tradeId(), null);
        settlementWriter.complete(trade.tradeId());
    }

    // ───────────────────────── 꾸밈은 카드를 따라간다 (2026-09-23 뒤집힘)

    @Test
    @DisplayName("카드가 팔려도 꾸밈이 남는다 — 사는 사람이 그대로 받는다")
    void decorationSurvivesSale() {
        Long sellerId = insertFundedUser("deco-seller@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("deco-buyer@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "판매 후 꾸밈 유지", 1),
                insertTicket(sellerId, fixture), sellerId);
        decorationService.save(sellerId, photocardId, request(insertSticker(sellerId)));

        insertListing(photocardId, sellerId, 3_000L);
        sell(buyerId, photocardId);

        assertThat(decorationRepository.findByPhotocardId(photocardId)).isPresent();
    }

    @Test
    @DisplayName("새 주인 화면에 꾸민 모습이 보인다")
    void decorationVisibleToNewOwner() {
        Long sellerId = insertFundedUser("vis-seller@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("vis-buyer@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "새 주인에게 보임", 1),
                insertTicket(sellerId, fixture), sellerId);
        decorationService.save(sellerId, photocardId, request(insertSticker(sellerId)));

        insertListing(photocardId, sellerId, 3_000L);
        sell(buyerId, photocardId);

        assertThat(nftService.getMyPhotocards(buyerId, null, null, 20).items())
                .singleElement()
                .satisfies(card -> assertThat(card.decoratedImageUrl()).isNotNull());
    }

    @Test
    @DisplayName("남의 카드 상세에서도 꾸민 모습이 보인다")
    void decorationVisibleToStranger() {
        Long ownerId = insertUser("pub-owner@test.com", "주인");
        Long strangerId = insertUser("pub-stranger@test.com", "남");
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "남에게도 보임", 1),
                insertTicket(ownerId, fixture), ownerId);
        decorationService.save(ownerId, photocardId, request(insertSticker(ownerId)));
        // 남이 상세를 열려면 마켓에 올라와 있어야 한다 (비공개 카드는 애초에 안 열린다)
        insertListing(photocardId, ownerId, 3_000L);

        assertThat(nftService.getPhotocard(photocardId, strangerId).decoratedImageUrl()).isNotNull();
    }

    @Test
    @DisplayName("새 주인이 물려받은 꾸밈을 덮어쓸 수 있다")
    void newOwnerCanOverwrite() {
        Long sellerId = insertFundedUser("ow-seller@test.com", "판매자", 10_000L);
        Long buyerId = insertFundedUser("ow-buyer@test.com", "구매자", 10_000L);
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "덮어쓰기", 1),
                insertTicket(sellerId, fixture), sellerId);
        Long sellerSticker = insertSticker(sellerId);
        decorationService.save(sellerId, photocardId, request(sellerSticker));
        insertListing(photocardId, sellerId, 3_000L);
        sell(buyerId, photocardId);

        /* 판 사람의 스티커는 그대로 붙어 있어야 하고(못 뗀다), 산 사람은 거기에 얹는다.
           🔴 UNIQUE 가 (photocard_id, user_id) 였다면 여기서 행이 둘이 되려다 막혔다. */
        decorationService.save(buyerId, photocardId, request(sellerSticker, insertSticker(buyerId)));

        assertThat(decorationRepository.findAll()).hasSize(1);
    }

    // ───────────────────────── 스티커는 붙이면 못 뗀다

    @Test
    @DisplayName("저장하면 스티커가 소모된다")
    void savingConsumesStickers() {
        Long userId = insertUser("consume@test.com", "꾸미는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);
        Long stickerId = insertSticker(userId);

        decorationService.save(userId, photocardId, request(stickerId));

        assertThat(isStickerUsed(stickerId)).isTrue();
    }

    @Test
    @DisplayName("🔴 이미 붙인 스티커를 빼면 거절한다")
    void cannotRemovePlacedSticker() {
        Long userId = insertUser("remove@test.com", "빼려는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);
        Long first = insertSticker(userId);
        Long second = insertSticker(userId);
        decorationService.save(userId, photocardId, request(first, second));

        // first 를 빼고 저장 시도
        assertThatThrownBy(() -> decorationService.save(userId, photocardId, request(second)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_STICKER_NOT_REMOVABLE));
    }

    @Test
    @DisplayName("자리만 옮겨 다시 저장하는 것은 된다")
    void canRearrangeWithoutRemoving() {
        Long userId = insertUser("move@test.com", "옮기는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);
        Long stickerId = insertSticker(userId);
        decorationService.save(userId, photocardId, request(stickerId));

        decorationService.save(userId, photocardId, request(stickerId));

        assertThat(decorationRepository.findAll()).hasSize(1);
    }

    @Test
    @DisplayName("다른 카드에 이미 쓴 스티커는 못 쓴다")
    void cannotReuseStickerOnAnotherCard() {
        Long userId = insertUser("reuse@test.com", "재사용하려는사람");
        Long firstCard = insertPhotocardOwnedBy(userId);
        Long secondCard = insertPhotocardOwnedBy(userId);
        Long stickerId = insertSticker(userId);
        decorationService.save(userId, firstCard, request(stickerId));

        assertThatThrownBy(() -> decorationService.save(userId, secondCard, request(stickerId)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_STICKER_ALREADY_USED));
    }

    @Test
    @DisplayName("같은 스티커를 한 카드에 두 번 올리면 거절한다")
    void cannotPlaceSameStickerTwice() {
        Long userId = insertUser("twice@test.com", "두번올리는사람");
        Long photocardId = insertPhotocardOwnedBy(userId);
        Long stickerId = insertSticker(userId);

        assertThatThrownBy(() ->
                decorationService.save(userId, photocardId, request(stickerId, stickerId)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_STICKER_ALREADY_USED));
    }

    @Test
    @DisplayName("남의 스티커는 못 쓴다")
    void cannotUseOthersSticker() {
        Long userId = insertUser("mine@test.com", "나");
        Long otherId = insertUser("others@test.com", "남");
        Long photocardId = insertPhotocardOwnedBy(userId);

        assertThatThrownBy(() ->
                decorationService.save(userId, photocardId, request(insertSticker(otherId))))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_STICKER_NOT_USABLE));
    }

    @Test
    @DisplayName("스티커가 거절되면 이미지가 올라가지 않는다")
    void rejectedSaveUploadsNothing() {
        Long userId = insertUser("noupload@test.com", "나");
        Long otherId = insertUser("noupload-other@test.com", "남");
        Long photocardId = insertPhotocardOwnedBy(userId);

        assertThatThrownBy(() ->
                decorationService.save(userId, photocardId, request(insertSticker(otherId))))
                .isInstanceOf(BusinessException.class);

        // 🔴 거절이 업로드보다 **먼저** 돌아야 MinIO 에 쓰레기가 안 남는다
        org.mockito.Mockito.verify(fileStorageService, org.mockito.Mockito.never())
                .uploadPublicBytes(any(), anyString(), anyString());
    }

    // ───────────────────────── 소유·입력 검사

    @Test
    @DisplayName("남의 카드는 꾸밀 수 없다")
    void cannotDecorateOthersCard() {
        Long ownerId = insertUser("card-owner@test.com", "주인");
        Long strangerId = insertUser("card-stranger@test.com", "남");
        Long photocardId = insertPhotocardOwnedBy(ownerId);

        assertThatThrownBy(() ->
                decorationService.save(strangerId, photocardId, request(insertSticker(strangerId))))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.PHOTOCARD_NOT_OWNED));
    }

    @Test
    @DisplayName("배치 JSON 이 깨져 있으면 거절한다")
    void rejectsBrokenPlacements() {
        Long userId = insertUser("broken@test.com", "나");
        Long photocardId = insertPhotocardOwnedBy(userId);

        assertThatThrownBy(() -> decorationService.save(userId, photocardId,
                new NftDecorationSaveRequest(TINY_PNG, "이건 JSON 이 아니다")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_PLACEMENTS_INVALID));
    }

    @Test
    @DisplayName("꾸민 적이 없으면 조회가 404 다")
    void findReturns404WhenMissing() {
        Long userId = insertUser("none@test.com", "안꾸민사람");
        Long photocardId = insertPhotocardOwnedBy(userId);

        assertThatThrownBy(() -> decorationService.find(photocardId))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(NftErrorCode.DECORATION_NOT_FOUND));
    }

    @Test
    @DisplayName("목록 조회는 카드 여러 장을 한 번에 가져온다")
    void listsManyAtOnce() {
        Long userId = insertUser("many@test.com", "여러장");
        Long first = insertPhotocardOwnedBy(userId);
        Long second = insertPhotocardOwnedBy(userId);
        decorationService.save(userId, first, request(insertSticker(userId)));

        assertThat(decorationService.imageUrlsOf(List.of(first, second))).hasSize(1);
    }

    // ───────────────────────── 꾸민 그림 주소 (2026-09-29 공개 고정 주소로)

    @Test
    @DisplayName("꾸민 그림은 공개 경로에 올라가고 고정 주소로 내려간다")
    void decorationImageIsPublic() {
        Long userId = insertUser("public-deco@test.com", "나");
        Long photocardId = insertPhotocardOwnedBy(userId);

        String url = decorationService.save(userId, photocardId, request(insertSticker(userId))).imageUrl();

        // 🔴 익명 읽기 정책이 걸린 접두사 밖으로 나가면 업로드는 되고 조회만 403 이 난다
        org.mockito.Mockito.verify(fileStorageService)
                .uploadPublicBytes(any(), org.mockito.ArgumentMatchers.eq("public/photocards/decorations"), anyString());
        assertThat(url).startsWith("https://example.test/public/public/photocards/decorations/");
        // 조회마다 같은 주소여야 브라우저·서비스워커 캐시가 맞는다
        assertThat(decorationService.imageUrlOf(photocardId)).isEqualTo(url);
    }

    @Test
    @DisplayName("예전(비공개 경로)에 저장된 꾸밈은 presigned 로 계속 보인다")
    void legacyDecorationStaysPresigned() {
        Long userId = insertUser("legacy-deco@test.com", "나");
        Long photocardId = insertPhotocardOwnedBy(userId);
        decorationService.save(userId, photocardId, request(insertSticker(userId)));
        jdbcTemplate.update("UPDATE photocard_decorations SET image_key = ? WHERE photocard_id = ?",
                "photocard/decoration/2026/09/old.png", photocardId);

        assertThat(decorationService.imageUrlOf(photocardId)).isEqualTo("https://example.test/signed.png");
    }
}
