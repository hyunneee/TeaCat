package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.nft.client.PhotocardNftMetadata;
import com.teacat.server.nft.dto.request.NftPhotocardDesignCreateRequest;
import com.teacat.server.nft.dto.response.NftDrawPoolCardResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDesignResponse;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 포토카드 도안을 만든다 — IPFS 핀부터 온체인 등록까지.
 *
 * <pre>
 * ① 이미지 바이트   → 핀 → imageCid
 * ② 메타데이터 JSON → 핀 → metadataCid      ← 체인에 올라가는 값은 이것 하나
 *    { "name": …, "image": "ipfs://imageCid" }
 * ③ designs 행 저장   image_url = 게이트웨이 URL
 * ④ 블록체인 API 로 도안 등록
 * </pre>
 *
 * <p><b>순서가 뒤바뀔 수 없다.</b> 메타데이터 JSON 안에 이미지 CID 가 들어가야 하기 때문이다.
 *
 * <p><b>④가 실패해도 도안은 남는다.</b> 핀은 이미 끝났고 CID 도 저장돼 있어 등록만 다시 보내면
 * 되기 때문이다. 여기서 예외를 밖으로 내보내면 어드민은 "실패" 를 보는데 행은 이미 만들어져 있어,
 * 같은 그림을 다시 올려 <b>도안이 두 개 생긴다.</b> (blockchain/PHOTOCARD_PLAN.md 10장)
 *
 * <p>트랜잭션은 {@link NftDesignChainWriter} 가 갖는다. 핀과 체인 호출이 네트워크를 기다리는
 * 동안 DB 커넥션을 쥐고 있으면 안 되기 때문에 이 클래스는 트랜잭션을 열지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NftPhotocardDesignService {

    /** 핀할 때 붙는 이름. Pinata 목록에서 무엇인지 알아볼 수 있으면 된다 */
    private static final String METADATA_FILENAME = "photocard-metadata.json";

    private final IpfsPinService ipfsPinService;
    private final NftPhotocardDesignRepository designRepository;
    private final PerformanceGeneralRepository performanceRepository;
    private final NftDesignChainWriter writer;
    private final NftDesignChainRegistrar registrar;

    public NftPhotocardDesignResponse create(NftPhotocardDesignCreateRequest request) {
        /* 핀을 먼저 하면 잘못된 요청에도 IPFS 에 쓰레기가 남는다. 핀은 되돌릴 수 없으므로
           되돌릴 수 있는 검사를 전부 앞에 둔다 */
        /* 2026-09-11: 뽑기 풀 도안은 템플릿 경로가 대신한다.
           등록(POST /admin/photocard-templates) → 넣기(POST /admin/performances/{id}/draw-designs
           또는 POST /admin/photocard-designs/event-pool). 등록할 때 수량을 정하지 않아도 되고,
           쓰지 않을 카드가 온체인에 올라가지 않는다.
        boolean drawPool = request.isDrawPool();
        if (drawPool == (request.performanceId() != null)) {
            throw new BusinessException(NftErrorCode.DESIGN_POOL_CONFLICT);
        }
        if (drawPool && (request.group() == null || request.group().isBlank() || request.grade() == null)) {
            throw new BusinessException(NftErrorCode.DESIGN_POOL_ATTRIBUTES_REQUIRED);
        }
        */
        // 이 경로는 공연 전용 도안(자동 발급용)만 만든다
        if (request.isDrawPool() || request.performanceId() == null) {
            throw new BusinessException(NftErrorCode.DESIGN_POOL_CONFLICT);
        }
        if (!performanceRepository.existsById(request.performanceId())) {
            throw new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND);
        }

        String imageCid = ipfsPinService.pinImage(request.image());
        /* 2026-09-11: 뽑기 풀 분기는 템플릿 경로로 옮겨갔다 (PhotocardNftMetadata.ofDrawPool 은
           NftPhotocardPoolService 가 쓴다).
        PhotocardNftMetadata metadata = drawPool
                ? PhotocardNftMetadata.ofDrawPool(...)
                : PhotocardNftMetadata.of(request.name(), request.description(), imageCid);
        */
        PhotocardNftMetadata metadata =
                PhotocardNftMetadata.of(request.name(), request.description(), imageCid);
        String metadataCid = ipfsPinService.pinJson(METADATA_FILENAME, metadata);

        // ipfs:// 는 브라우저가 못 연다. 화면 코드가 그대로 쓰도록 게이트웨이 주소를 넣는다
        String imageUrl = ipfsPinService.gatewayUrl(imageCid);
        /* 2026-09-11: 같은 이유로 writer.createDrawPool 분기도 빠졌다.
        NftPhotocardDesign design = drawPool
                ? writer.createDrawPool(...)
                : writer.create(...);
        */
        NftPhotocardDesign design = writer.create(request.performanceId(), request.name(), imageUrl,
                request.totalSupply(), imageCid, metadataCid);

        try {
            registrar.register(design.getId(), false);
        } catch (RuntimeException e) {
            log.error("도안은 만들었지만 온체인 등록에 실패했습니다. 재시도할 수 있습니다 designId={}",
                    design.getId(), e);
        }

        return get(design.getId());
    }

    /**
     * 등록을 다시 보낸다. 등록은 멱등이라 몇 번을 불러도 안전하다.
     *
     * @param force 확정 대기 중(REGISTERING)이어도 보낼지. 확정 감시가 멈춰 있을 때만 쓴다
     */
    public NftPhotocardDesignResponse retryRegistration(Long designId, boolean force) {
        registrar.register(designId, force);
        return get(designId);
    }

    public NftPhotocardDesignResponse get(Long designId) {
        return NftPhotocardDesignResponse.from(designRepository.findById(designId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DESIGN_NOT_FOUND)));
    }

    /** 어드민이 보는 이벤트 풀 — 몇 종이 등록됐고 몇 장 남았나. 공연별 도안은 빠진다 */
    /**
     * 도감 목록 — <b>일반 사용자용</b>.
     *
     * <p>어드민의 {@link #getDrawPool()} 과 같은 행을 보지만 내려주는 것이 다르다
     * ({@link NftDrawPoolCardResponse}) — 남은 수량·CID·체인 상태는 운영 정보다.
     *
     * <p>🔴 <b>공연 좌석에서 나오는 도안은 담기지 않는다</b>({@code performanceId IS NULL}).
     * 그건 아직 열리지 않은 공연의 카드까지 도감에 미리 보여주는 셈이 되고, 역할
     * 꼬리표({@code group})도 뽑기 풀 도안에만 붙어 있어 거를 방법이 없다.
     */
    @Transactional(readOnly = true)
    public List<NftDrawPoolCardResponse> getDrawPoolCards() {
        return designRepository.findAllByDrawPoolTrueAndPerformanceIdIsNullOrderByIdAsc().stream()
                .map(NftDrawPoolCardResponse::from)
                .toList();
    }

    public List<NftPhotocardDesignResponse> getDrawPool() {
        return designRepository.findAllByDrawPoolTrueAndPerformanceIdIsNullOrderByIdAsc().stream()
                .map(NftPhotocardDesignResponse::from)
                .toList();
    }

    public List<NftPhotocardDesignResponse> getByPerformance(Long performanceId) {
        return designRepository.findAllByPerformanceIdAndDrawPoolFalseOrderByIdAsc(performanceId).stream()
                .map(NftPhotocardDesignResponse::from)
                .toList();
    }
}
