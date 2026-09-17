package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardChainClient.IssueItem;
import com.teacat.server.nft.client.PhotocardIssueResult;
import com.teacat.server.nft.dto.response.MyNftPhotocardResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDetailResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDrawResponse;
import com.teacat.server.nft.dto.response.NftPhotocardPackClaimResponse;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.service.NftPhotocardDrawWriter.DrawOutcome;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 뽑기 — 팩 하나로 도안 하나를 뽑아 카드 한 장을 만든다.
 *
 * <p>체인·IPFS 는 스텁이다. {@code NftPhotocardDesignServiceIntegrationTests} 와 같은 빈을 스텁으로
 * 바꿔야 Spring 컨텍스트를 공유한다 — 다르면 컨테이너 위에 컨텍스트가 하나 더 뜬다.
 */
class NftPhotocardDrawServiceIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private NftPhotocardDrawWriter writer;

    @Autowired
    private NftPhotocardDrawService drawService;

    @Autowired
    private NftPhotocardMinter minter;

    @Autowired
    private NftService nftService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private PhotocardChainClient chainClient;

    @MockitoBean
    private IpfsPinService ipfsPinService;

    private Long userWithWallet() {
        Long userId = insertUser("draw@test.com", "뽑는사람");
        insertWallet(userId);
        return userId;
    }

    private Integer issuedSupplyOf(Long designId) {
        return jdbcTemplate.queryForObject(
                "SELECT issued_supply FROM nft_photocard_designs WHERE id = ?", Integer.class, designId);
    }

    private Integer unconsumedPacksOf(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*)::int FROM nft_photocard_packs WHERE user_id = ? AND consumed_at IS NULL",
                Integer.class, userId);
    }

    /**
     * 진행 중인 이벤트 하나. {@code claimEventPack} 의 판정이 설정값에서 표(Task 5)로 옮겨가
     * 이제 기본은 비어 있다({@code cleanDatabase} 가 매번 비운다) — 이벤트 지급을 검증하는 테스트는
     * 먼저 이 표에 진행 중인 행을 넣어야 한다.
     */
    private void givenActiveEvent(String code) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_pack_events (code, name, active)
                VALUES (?, '테스트 이벤트', true)
                """, code);
    }

    @Test
    void 팩_하나로_카드_한_장을_뽑는다() {
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");
        UUID key = UUID.randomUUID();

        DrawOutcome outcome = writer.draw(userId, key);

        assertThat(outcome.replayed()).isFalse();
        assertThat(outcome.designId()).isEqualTo(designId);
        assertThat(outcome.designName()).isEqualTo("김예린");
        assertThat(outcome.imageUrl()).isEqualTo("/draw.png");
        assertThat(outcome.group()).isEqualTo("서울 5반");
        assertThat(outcome.grade()).isEqualTo(NftPhotocardGrade.SPECIAL);
        assertThat(outcome.issuedAt()).isNotNull();
        assertThat(outcome.walletAddress()).isEqualTo(addressOf(userId));

        // 카드 행: 티켓 없음 · PENDING · 지갑 채워짐
        var card = jdbcTemplate.queryForMap(
                "SELECT ticket_id, owner_id, wallet_id, status::text AS status FROM nft_photocards WHERE id = ?",
                outcome.photocardId());
        assertThat(card.get("ticket_id")).isNull();
        assertThat(card.get("owner_id")).isEqualTo(userId);
        assertThat(card.get("wallet_id")).isNotNull();
        assertThat(card.get("status")).isEqualTo("PENDING");

        assertThat(issuedSupplyOf(designId)).isEqualTo(1);
        assertThat(unconsumedPacksOf(userId)).isZero();

        // 팩 행에 결과와 키가 남는다
        var pack = jdbcTemplate.queryForMap(
                "SELECT photocard_id, idempotency_key FROM nft_photocard_packs WHERE user_id = ?", userId);
        assertThat(pack.get("photocard_id")).isEqualTo(outcome.photocardId());
        assertThat(pack.get("idempotency_key")).isEqualTo(key);
    }

    @Test
    void 같은_키로_다시_뽑으면_그때_준_카드를_그대로_돌려준다() {
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        insertPack(userId, "EVENT_B");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");
        UUID key = UUID.randomUUID();

        DrawOutcome first = writer.draw(userId, key);
        DrawOutcome second = writer.draw(userId, key);

        assertThat(second.replayed()).isTrue();
        assertThat(second.photocardId()).isEqualTo(first.photocardId());
        // 팩은 하나만 썼다
        assertThat(unconsumedPacksOf(userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isEqualTo(1L);
    }

    @Test
    void 팩이_없으면_409_이고_아무것도_바뀌지_않는다() {
        Long userId = userWithWallet();
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.PACK_NOT_AVAILABLE);

        assertThat(issuedSupplyOf(designId)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    @Test
    void 뽑을_도안이_없으면_409_이고_팩은_남는다() {
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        // 소진된 풀 도안 · 미등록 풀 도안 · 공연 도안만 있다 — 셋 다 후보가 아니다
        Long exhausted = insertDrawPoolDesign("소진", 1, "개발자", "COMMON");
        jdbcTemplate.update("UPDATE nft_photocard_designs SET issued_supply = 1 WHERE id = ?", exhausted);
        Long unregistered = insertDrawPoolDesign("미등록", 10, "개발자", "COMMON");
        jdbcTemplate.update("UPDATE nft_photocard_designs SET chain_status = 'PENDING' WHERE id = ?", unregistered);
        insertDesign(insertPerformanceFixture().performanceId(), "공연 도안", 10);

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DRAW_POOL_EMPTY);

        assertThat(unconsumedPacksOf(userId)).isEqualTo(1);
    }

    @Test
    void 지갑이_없으면_거절하고_팩은_남는다() {
        Long userId = insertUser("nowallet@test.com", "지갑없음");
        insertPack(userId, "EVENT_A");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.RECIPIENT_WALLET_NOT_FOUND);

        assertThat(unconsumedPacksOf(userId)).isEqualTo(1);
    }

    @Test
    void 이벤트_팩은_계정당_한_번이다() {
        Long userId = userWithWallet();
        givenActiveEvent("OPEN_EVENT");

        assertThat(writer.claimEventPack(userId)).isTrue();
        assertThat(writer.counts(userId).openable()).isEqualTo(1);

        // 두 번째는 존재 확인이 잡아 false 다. (존재 확인과 INSERT 사이에 끼어든 동시 요청만
        // UNIQUE 위반 예외로 나가고, 그건 서비스(Task 4)가 잡아 granted:false 로 바꾼다)
        assertThat(writer.claimEventPack(userId)).isFalse();
        assertThat(writer.counts(userId).openable()).isEqualTo(1);

        // UNIQUE 가 실제로 걸려 있는지는 SQL 로 직접 확인한다
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO nft_photocard_packs (user_id, source, source_ref) VALUES (?, 'EVENT', 'OPEN_EVENT')",
                userId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    /* ── 서비스: 체인 전송 · 멱등 · 동시성 · 이벤트 응답 ───────────────────────── */

    private void givenChainAccepts() {
        willReturn(new PhotocardIssueResult("PENDING", "0x" + "c".repeat(64), 1))
                .given(chainClient).issuePhotocards(any());
    }

    @Test
    void 뽑으면_그_카드_한_장을_곧바로_체인에_보낸다() {
        givenChainAccepts();
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        NftPhotocardDrawResponse response = drawService.draw(userId, UUID.randomUUID().toString());

        assertThat(response.designName()).isEqualTo("김예린");
        assertThat(response.group()).isEqualTo("서울 5반");
        assertThat(response.grade()).isEqualTo(NftPhotocardGrade.SPECIAL);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<IssueItem>> items = ArgumentCaptor.forClass(List.class);
        verify(chainClient).issuePhotocards(items.capture());
        assertThat(items.getValue()).hasSize(1);
        IssueItem item = items.getValue().getFirst();
        assertThat(item.photocardKey()).isEqualTo(jdbcTemplate.queryForObject(
                "SELECT issue_key FROM nft_photocards WHERE id = ?", String.class, response.photocardId()));
        assertThat(item.designId()).isEqualTo(jdbcTemplate.queryForObject(
                "SELECT COALESCE(chain_token_id::text, id::text) FROM nft_photocard_designs WHERE id = ?",
                String.class, designId));
        assertThat(item.photocardId()).isEqualTo(response.photocardId());
        assertThat(item.designDbId()).isEqualTo(designId);
        assertThat(item.to()).isEqualTo(addressOf(userId));
    }

    @Test
    void 체인_전송이_실패해도_카드는_남고_팩은_소비되고_응답은_성공이다() {
        willThrow(new BusinessException(NftErrorCode.PHOTOCARD_MINT_FAILED))
                .given(chainClient).issuePhotocards(any());
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        NftPhotocardDrawResponse response = drawService.draw(userId, UUID.randomUUID().toString());

        assertThat(response.photocardId()).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_photocards WHERE id = ?", String.class, response.photocardId()))
                .isEqualTo("PENDING");
        assertThat(unconsumedPacksOf(userId)).isZero();

        // 스위퍼 경로가 그 카드를 다시 집어 보낸다
        givenChainAccepts();
        assertThat(minter.mintPendingDraws(200)).isEqualTo(1);
    }

    @Test
    void 같은_키로_다시_부르면_체인에_다시_보내지_않는다() {
        givenChainAccepts();
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");
        String key = UUID.randomUUID().toString();

        NftPhotocardDrawResponse first = drawService.draw(userId, key);
        NftPhotocardDrawResponse second = drawService.draw(userId, key);

        assertThat(second.photocardId()).isEqualTo(first.photocardId());
        verify(chainClient, times(1)).issuePhotocards(any());
    }

    @Test
    void 키가_UUID_가_아니면_거절한다() {
        Long userId = userWithWallet();

        assertThatThrownBy(() -> drawService.draw(userId, "not-a-uuid"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.INVALID_IDEMPOTENCY_KEY);
        assertThatThrownBy(() -> drawService.draw(userId, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.INVALID_IDEMPOTENCY_KEY);
        verifyNoInteractions(chainClient);
    }

    @Test
    void 팩_하나에_키가_다른_동시_요청은_한_장만_나간다() throws Exception {
        givenChainAccepts();
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        int threads = 4;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Object>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    return drawService.draw(userId, UUID.randomUUID().toString());
                } catch (BusinessException e) {
                    return e.getErrorCode();
                }
            }));
        }
        start.countDown();
        int success = 0;
        int noPack = 0;
        for (Future<Object> f : futures) {
            Object result = f.get();
            if (result instanceof NftPhotocardDrawResponse) success++;
            else if (result == NftErrorCode.PACK_NOT_AVAILABLE) noPack++;
        }
        pool.shutdown();

        assertThat(success).isEqualTo(1);
        assertThat(noPack).isEqualTo(threads - 1);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isEqualTo(1L);
    }

    @Test
    void 이벤트_팩_지급_응답() {
        Long userId = userWithWallet();
        givenActiveEvent("OPEN_EVENT");

        NftPhotocardPackClaimResponse first = drawService.claimEventPack(userId);
        NftPhotocardPackClaimResponse second = drawService.claimEventPack(userId);

        assertThat(first.granted()).isTrue();
        assertThat(first.remaining()).isEqualTo(1);
        assertThat(second.granted()).isFalse();
        assertThat(second.remaining()).isEqualTo(1);

        assertThat(drawService.status(userId).available()).isTrue();
        assertThat(drawService.status(userId).remaining()).isEqualTo(1);
    }

    /* ── API ─────────────────────────────────────────────────────────────── */

    @Test
    void API_흐름_팩_받기_상태_뽑기_팩없음() throws Exception {
        givenChainAccepts();
        Long userId = userWithWallet();
        givenActiveEvent("OPEN_EVENT");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");
        String bearer = "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);

        mockMvc.perform(get("/photocards/draw").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(false))
                .andExpect(jsonPath("$.data.remaining").value(0));

        mockMvc.perform(post("/photocards/packs/claim").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.granted").value(true))
                .andExpect(jsonPath("$.data.remaining").value(1));

        mockMvc.perform(post("/photocards/draw")
                        .header("Authorization", bearer)
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.designName").value("김예린"))
                .andExpect(jsonPath("$.data.group").value("서울 5반"))
                .andExpect(jsonPath("$.data.grade").value("SPECIAL"))
                .andExpect(jsonPath("$.data.photocardId").isNumber());

        // 팩을 다 썼다 — 409 와 사람이 읽을 message
        mockMvc.perform(post("/photocards/draw")
                        .header("Authorization", bearer)
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_040"))
                .andExpect(jsonPath("$.message").value("지금 열 수 있는 카드팩이 없어요."));

        // 키 없이 오면 400
        mockMvc.perform(post("/photocards/draw").header("Authorization", bearer))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NFT_009"));
    }

    /* ── 기존 조회: 뽑은 카드가 보여야 한다 ─────────────────────────────────── */

    @Test
    void 뽑은_카드는_내_포카와_상세에_보이고_공연은_null_소속_등급은_채워진다() {
        givenChainAccepts();
        Long userId = userWithWallet();
        insertPack(userId, "EVENT_A");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");
        Long photocardId = drawService.draw(userId, UUID.randomUUID().toString()).photocardId();

        NftCursorPageResponse<MyNftPhotocardResponse> mine = nftService.getMyPhotocards(userId, null, null, 20);
        assertThat(mine.items()).hasSize(1);
        MyNftPhotocardResponse item = mine.items().getFirst();
        assertThat(item.photocardId()).isEqualTo(photocardId);
        assertThat(item.performanceTitle()).isNull();
        assertThat(item.group()).isEqualTo("서울 5반");
        assertThat(item.grade()).isEqualTo(NftPhotocardGrade.SPECIAL);
        assertThat(item.averagePrice()).isNull();

        NftPhotocardDetailResponse detail = nftService.getPhotocard(photocardId, userId);
        assertThat(detail.performanceTitle()).isNull();
        assertThat(detail.origin()).isNull();
        assertThat(detail.group()).isEqualTo("서울 5반");
        assertThat(detail.grade()).isEqualTo(NftPhotocardGrade.SPECIAL);
        assertThat(detail.averagePrice()).isNull();
    }

    @Test
    void 공연_카드는_전처럼_보이고_평균가는_같은_도안_거래에서_나온다() {
        Long ownerId = insertFundedUser("owner@test.com", "소유자", 0);
        Long photocardId = insertPhotocardOwnedBy(ownerId);
        // 같은 도안의 다른 카드가 1000, 2000 에 거래됐다
        Long designId = jdbcTemplate.queryForObject(
                "SELECT design_id FROM nft_photocards WHERE id = ?", Long.class, photocardId);
        Long buyerId = insertUser("buyer@test.com", "구매자");
        for (long price : new long[]{1000, 2000}) {
            Long otherCard = jdbcTemplate.queryForObject("""
                    INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                    VALUES (?, NULL, ?, 'PENDING') RETURNING id
                    """, Long.class, designId, ownerId);
            Long listingId = jdbcTemplate.queryForObject("""
                    INSERT INTO nft_photocard_listings (photocard_id, seller_id, price, description, status, closed_at)
                    VALUES (?, ?, ?, '설명', 'SOLD', now()) RETURNING id
                    """, Long.class, otherCard, ownerId, price);
            jdbcTemplate.update("""
                    INSERT INTO nft_photocard_trades
                        (listing_id, photocard_id, seller_id, buyer_id, price, idempotency_key)
                    VALUES (?, ?, ?, ?, ?, gen_random_uuid())
                    """, listingId, otherCard, ownerId, buyerId, price);
        }

        NftPhotocardDetailResponse detail = nftService.getPhotocard(photocardId, ownerId);
        assertThat(detail.performanceTitle()).isEqualTo("테스트 공연");
        assertThat(detail.origin()).isNotNull();
        assertThat(detail.origin().seatGrade()).isEqualTo("VIP");
        assertThat(detail.group()).isNull();
        assertThat(detail.grade()).isNull();
        assertThat(detail.averagePrice()).isEqualTo(1500L);

        MyNftPhotocardResponse item = nftService.getMyPhotocards(ownerId, null, null, 20).items().stream()
                .filter(i -> i.photocardId().equals(photocardId)).findFirst().orElseThrow();
        assertThat(item.averagePrice()).isEqualTo(1500L);
    }

    @Test
    void 토큰_없이_부르면_401_이다() throws Exception {
        // GET /photocards/** 는 공개인데 /photocards/draw 만은 인증이어야 한다 (SecurityConfig)
        mockMvc.perform(get("/photocards/draw")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/photocards/draw")
                .header("Idempotency-Key", UUID.randomUUID().toString())).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/photocards/packs/claim")).andExpect(status().isUnauthorized());
    }
}
