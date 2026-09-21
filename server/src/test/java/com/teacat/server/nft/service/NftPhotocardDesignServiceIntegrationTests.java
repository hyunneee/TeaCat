package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.client.ChainTxReport;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardDesignRegisterResult;
import com.teacat.server.nft.client.PhotocardNftMetadata;
import com.teacat.server.nft.dto.request.NftPhotocardDesignCreateRequest;
import com.teacat.server.nft.dto.response.NftPhotocardDesignResponse;
import com.teacat.server.nft.entity.NftDesignChainStatus;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.multipart.MultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * 도안 생성 — 핀 → 저장 → 온체인 등록.
 *
 * <p>Pinata 와 블록체인 서비스는 스텁이다. 여기서 보려는 것은 <b>순서와 실패했을 때 남는 것</b>이지
 * 외부 서비스의 응답이 아니다.
 */
class NftPhotocardDesignServiceIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;

    @Autowired
    private com.teacat.server.auth.security.JwtTokenProvider jwtTokenProvider;

    @Test
    void organizerRegistrationReachesChainOnlyForOwnPerformance() throws Exception {
        Long owner = insertUser("design-owner@test.com", "design-owner", "PERFORMANCE");
        jdbcTemplate.update("UPDATE performance_general SET created_by = ? WHERE id = ?", owner, performanceId);
        Long other = insertPerformanceFixture().performanceId();
        String auth = "Bearer " + jwtTokenProvider.createAccessToken(owner,
                com.teacat.server.user.entity.UserRole.PERFORMANCE);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart("/admin/photocard-designs")
                .file((MockMultipartFile) image()).param("performanceId", other.toString())
                .param("name", "Other card").param("totalSupply", "100")
                .header("Authorization", auth))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        verifyNoInteractions(ipfsPinService, chainClient);

        givenChainAccepts("PENDING");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart("/admin/photocard-designs")
                .file((MockMultipartFile) image()).param("performanceId", performanceId.toString())
                .param("name", "Own card").param("totalSupply", "100")
                .header("Authorization", auth))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.chainStatus").value("REGISTERING"));
        verify(chainClient).registerDesign(any(), any(), eq(100), eq(METADATA_CID));
    }

    private static final String IMAGE_CID = "bafyIMAGE";
    private static final String METADATA_CID = "bafyMETADATA";
    /** MinIO 가 실패했을 때만 쓰이는 폴백 주소 */
    private static final String GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/" + IMAGE_CID;
    /** 평소에 화면이 쓰는 주소 — MinIO 공개 경로 */
    private static final String STORAGE_URL =
            "https://teacat.site/storage/teacat/public/photocards/" + IMAGE_CID + ".png";
    private static final String TX_HASH = "0x" + "a".repeat(64);
    private static final String CONTRACT = "0x" + "b".repeat(40);

    @Autowired
    private NftPhotocardDesignService designService;

    @Autowired
    private NftDesignChainRegistrar registrar;

    @Autowired
    private NftDesignChainWriter writer;

    @MockitoBean
    private IpfsPinService ipfsPinService;

    @MockitoBean
    private PhotocardChainClient chainClient;

    @MockitoBean
    private FileStorageService fileStorageService;

    private Long performanceId;

    @BeforeEach
    void setUpPins() {
        performanceId = insertPerformanceFixture().performanceId();

        given(ipfsPinService.pinImage(any())).willReturn(IMAGE_CID);
        given(ipfsPinService.pinJson(any(), any())).willReturn(METADATA_CID);
        given(ipfsPinService.gatewayUrl(IMAGE_CID)).willReturn(GATEWAY_URL);
        given(fileStorageService.uploadPublic(any(), anyString(), anyString())).willReturn(STORAGE_URL);
        given(chainClient.photocardContractAddress()).willReturn(CONTRACT);
    }

    private static MultipartFile image() {
        return new MockMultipartFile("image", "card.png", "image/png", new byte[]{1, 2, 3});
    }

    private NftPhotocardDesignCreateRequest request() {
        return new NftPhotocardDesignCreateRequest(
                performanceId, "한정 포토카드 A", "2026 콘서트 기념", 100, image(), null, null, null);
    }

    private NftPhotocardDesignCreateRequest drawPoolRequest() {
        return new NftPhotocardDesignCreateRequest(
                null, "김예린", "TeaCat 포토카드", 100, image(), true, "서울 5반", NftPhotocardGrade.SPECIAL);
    }

    /*
     * given(mock.method()) 이 아니라 willReturn(...).given(mock) 형태여야 한다. 앞 형태는 스텁을
     * 다시 걸려고 메서드를 실제로 부르는데, 이미 willThrow 가 걸려 있으면 그 자리에서 터진다.
     */
    private void givenChainAccepts(String status) {
        willReturn(new PhotocardDesignRegisterResult(
                status, "PENDING".equals(status) ? TX_HASH : null,
                "1", "100", "ipfs://" + METADATA_CID))
                .given(chainClient).registerDesign(any(), any(), anyInt(), eq(METADATA_CID));
    }

    @Test
    void 도안을_만들면_핀_두_개와_등록_요청까지_간다() {
        givenChainAccepts("PENDING");

        NftPhotocardDesignResponse response = designService.create(request());

        assertThat(response.imageCid()).isEqualTo(IMAGE_CID);
        assertThat(response.metadataCid()).isEqualTo(METADATA_CID);
        // 화면이 쓰는 주소는 MinIO 사본이다. 게이트웨이를 직접 보던 시절에는
        // Pinata 한도가 차는 날 포토카드가 뜨는 모든 화면이 함께 깨졌다 (2026-09-21)
        assertThat(response.imageUrl()).isEqualTo(STORAGE_URL);
        // 체인이 가리키는 문서는 게이트웨이가 아니라 스킴 주소다
        assertThat(response.metadataUri()).isEqualTo("ipfs://" + METADATA_CID);
        assertThat(response.chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERING);
        assertThat(response.registerTxHash()).isEqualTo(TX_HASH);
        assertThat(response.contractAddress()).isEqualTo(CONTRACT);
        assertThat(response.chainId()).isEqualTo(blockchainProperties.chainId());
    }

    /**
     * MinIO 사본은 화면 편의지 NFT 의 성립 조건이 아니다. CID 는 이미 손에 있고 온체인 등록도
     * 그 CID 로 된다 — 여기서 막아 세우면 MinIO 가 잠깐 흔들릴 때 도안을 아예 못 만든다.
     */
    @Test
    void 그림_사본_업로드가_실패해도_도안은_만들어지고_게이트웨이로_물러선다() {
        givenChainAccepts("PENDING");
        willThrow(new BusinessException(NftErrorCode.DESIGN_NOT_FOUND))
                .given(fileStorageService).uploadPublic(any(), anyString(), anyString());

        NftPhotocardDesignResponse response = designService.create(request());

        assertThat(response.imageUrl()).isEqualTo(GATEWAY_URL);
        // 핀도 온체인 등록도 그대로 간다 — 실패한 건 화면용 사본뿐이다
        assertThat(response.imageCid()).isEqualTo(IMAGE_CID);
        assertThat(response.chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERING);
    }

    @Test
    void 메타데이터_JSON_은_이미지_CID_를_ipfs_스킴으로_가리킨다() {
        givenChainAccepts("PENDING");

        designService.create(request());

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(ipfsPinService).pinJson(any(), payload.capture());

        PhotocardNftMetadata metadata = (PhotocardNftMetadata) payload.getValue();
        assertThat(metadata.name()).isEqualTo("한정 포토카드 A");
        assertThat(metadata.description()).isEqualTo("2026 콘서트 기념");
        // 게이트웨이 URL 을 넣으면 그 게이트웨이가 죽는 날 카드가 깨진다
        assertThat(metadata.image()).isEqualTo("ipfs://" + IMAGE_CID);
    }

    @Test
    void 이미_같은_값으로_등록돼_있으면_기다리지_않고_확정이다() {
        givenChainAccepts("ALREADY_DONE");

        NftPhotocardDesignResponse response = designService.create(request());

        assertThat(response.chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERED);
        assertThat(response.registeredAt()).isNotNull();
    }

    @Test
    void 온체인_등록이_실패해도_도안은_남고_재시도로_살아난다() {
        willThrow(new BusinessException(NftErrorCode.DESIGN_REGISTRATION_FAILED))
                .given(chainClient).registerDesign(any(), any(), anyInt(), any());

        NftPhotocardDesignResponse created = designService.create(request());

        // 핀은 이미 끝났다. 여기서 도안까지 없애면 어드민이 같은 그림을 다시 올려 도안이 둘 생긴다
        assertThat(created.chainStatus()).isEqualTo(NftDesignChainStatus.PENDING);
        assertThat(created.metadataCid()).isEqualTo(METADATA_CID);
        assertThat(created.registerTxHash()).isNull();

        givenChainAccepts("ALREADY_DONE");
        NftPhotocardDesignResponse retried = designService.retryRegistration(created.designId(), false);

        assertThat(retried.chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERED);
    }

    @Test
    void 이미_등록이_확정된_도안은_다시_보내지_않는다() {
        givenChainAccepts("ALREADY_DONE");
        Long designId = designService.create(request()).designId();

        assertThatThrownBy(() -> designService.retryRegistration(designId, false))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.DESIGN_ALREADY_REGISTERED);
    }

    @Test
    void 확정_대기중인_도안은_force_없이는_다시_보내지_않는다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();

        assertThatThrownBy(() -> designService.retryRegistration(designId, false))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.DESIGN_REGISTRATION_IN_PROGRESS);
    }

    @Test
    void 확정을_확인하면_REGISTERED_가_된다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();

        given(chainClient.txReport(TX_HASH)).willReturn(new ChainTxReport("CONFIRMED", TX_HASH, 100));

        assertThat(registrar.confirm(designId, TX_HASH)).isTrue();
        assertThat(designService.get(designId).chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERED);
    }

    @Test
    void 체인이_거부하면_FAILED_로_남는다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();

        given(chainClient.txReport(TX_HASH)).willReturn(new ChainTxReport("FAILED", TX_HASH, 100));

        assertThat(registrar.confirm(designId, TX_HASH)).isTrue();
        assertThat(designService.get(designId).chainStatus()).isEqualTo(NftDesignChainStatus.FAILED);
    }

    @Test
    void 아직_안_실린_트랜잭션은_아무것도_확정하지_않는다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();

        given(chainClient.txReport(TX_HASH)).willReturn(new ChainTxReport("PENDING", TX_HASH, null));

        assertThat(registrar.confirm(designId, TX_HASH)).isFalse();
        assertThat(designService.get(designId).chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERING);
    }

    @Test
    void 없는_공연이면_핀을_시작하기_전에_거절한다() {
        NftPhotocardDesignCreateRequest request = new NftPhotocardDesignCreateRequest(
                999_999L, "한정 포토카드", null, 100, image(), null, null, null);

        assertThatThrownBy(() -> designService.create(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.PERFORMANCE_NOT_FOUND);

        // 핀은 되돌릴 수 없다. 되돌릴 수 있는 검사가 앞에 와야 IPFS 에 쓰레기가 안 남는다
        verifyNoInteractions(ipfsPinService);
    }

    /* ── 뽑기 풀 도안: 공연 없이 소속·등급을 갖는다 ─────────────────────────── */

    @Test
    void 뽑기_풀_도안_등록_경로는_템플릿_방식으로_대체되어_거절한다() {
        // 2026-09-11: drawPool=true 로 직접 등록하던 옛 경로다. 템플릿 등록(POST
        // /admin/photocard-templates) → 풀에 넣기(POST /admin/performances/{id}/draw-designs 또는
        // POST /admin/photocard-designs/event-pool) 로 옮겨갔고, 이 경로는 이제 핀을 시작하기도
        // 전에 NFT_042 로 거절한다. "소속·등급이 남는다" 는 옛 단언은
        // NftPhotocardPoolIntegrationTests#이벤트_풀에_넣은_도안은_공연이_없다 로 옮겼다.
        assertThatThrownBy(() -> designService.create(drawPoolRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DESIGN_POOL_CONFLICT);

        verifyNoInteractions(ipfsPinService);
    }

    @Test
    void 공연_도안_메타데이터에는_속성이_없다() {
        givenChainAccepts("PENDING");

        designService.create(request());

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(ipfsPinService).pinJson(any(), payload.capture());
        assertThat(((PhotocardNftMetadata) payload.getValue()).attributes()).isNull();
    }

    @Test
    void 뽑기_풀과_공연을_같이_보내면_거절하고_핀하지_않는다() {
        NftPhotocardDesignCreateRequest both = new NftPhotocardDesignCreateRequest(
                performanceId, "김예린", null, 100, image(), true, "서울 5반", NftPhotocardGrade.SPECIAL);
        NftPhotocardDesignCreateRequest neither = new NftPhotocardDesignCreateRequest(
                null, "김예린", null, 100, image(), false, null, null);

        assertThatThrownBy(() -> designService.create(both))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DESIGN_POOL_CONFLICT);
        assertThatThrownBy(() -> designService.create(neither))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DESIGN_POOL_CONFLICT);
        verifyNoInteractions(ipfsPinService);
    }

    @Test
    void 뽑기_풀인데_소속이나_등급이_없어도_이제는_같은_이유로_거절한다() {
        // 2026-09-11: 소속·등급 필수 검사(NFT_043)는 drawPool 분기와 함께 주석 처리됐다.
        // drawPool=true 는 소속·등급 유무와 관계없이 NFT_042(DESIGN_POOL_CONFLICT) 로 막힌다.
        NftPhotocardDesignCreateRequest noGrade = new NftPhotocardDesignCreateRequest(
                null, "김예린", null, 100, image(), true, "서울 5반", null);
        NftPhotocardDesignCreateRequest noGroup = new NftPhotocardDesignCreateRequest(
                null, "김예린", null, 100, image(), true, "  ", NftPhotocardGrade.COMMON);

        assertThatThrownBy(() -> designService.create(noGrade))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DESIGN_POOL_CONFLICT);
        assertThatThrownBy(() -> designService.create(noGroup))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(NftErrorCode.DESIGN_POOL_CONFLICT);
        verifyNoInteractions(ipfsPinService);
    }

    /*
     * 아래 둘은 force 재요청과 확정 감시가 겹치는 순간을 재현한다. 서비스 경로로는 만들 수 없어
     * (claim 이 먼저 막는다) 기록 계층을 직접 부른다.
     */

    @Test
    void 확정된_도안은_뒤늦게_온_등록_응답에_덮이지_않는다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();
        given(chainClient.txReport(TX_HASH)).willReturn(new ChainTxReport("CONFIRMED", TX_HASH, 100));
        registrar.confirm(designId, TX_HASH);

        String laterTx = "0x" + "c".repeat(64);
        writer.applyRegisterResult(designId,
                new PhotocardDesignRegisterResult("PENDING", laterTx, "1", "100", "ipfs://" + METADATA_CID),
                31221, CONTRACT);

        // 되돌아가면 "등록됐는데 안 됐다고 말하는" 행이 된다
        assertThat(designService.get(designId).chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERED);
        assertThat(designService.get(designId).registerTxHash()).isEqualTo(TX_HASH);
    }

    @Test
    void 재요청이_실패해도_먼저_보낸_트랜잭션은_지우지_않는다() {
        givenChainAccepts("PENDING");
        Long designId = designService.create(request()).designId();

        writer.applyRegisterNotSent(designId);

        // 지우면 먼저 나간 트랜잭션이 확정돼도 감시가 그 해시를 찾지 못한다
        NftPhotocardDesignResponse design = designService.get(designId);
        assertThat(design.chainStatus()).isEqualTo(NftDesignChainStatus.REGISTERING);
        assertThat(design.registerTxHash()).isEqualTo(TX_HASH);
    }

    @Test
    void 공연의_도안_목록을_돌려준다() {
        givenChainAccepts("PENDING");
        designService.create(request());
        designService.create(request());

        assertThat(designService.getByPerformance(performanceId)).hasSize(2);
    }
}
