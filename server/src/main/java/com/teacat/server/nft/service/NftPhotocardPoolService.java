package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.nft.client.PhotocardNftMetadata;
import com.teacat.server.nft.dto.request.NftPoolAddRequest;
import com.teacat.server.nft.dto.response.NftPerformancePoolResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDesignResponse;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardTemplate;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.repository.NftPhotocardTemplateRepository;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 뽑기 풀 — 템플릿과 수량으로 도안을 만든다.
 *
 * <p>공연에 넣기와 이벤트 풀에 넣기가 같은 동작이다. 차이는 도안의 공연이 있느냐뿐이다.
 *
 * <p><b>그림은 다시 올리지 않는다.</b> 템플릿의 {@code imageCid} 를 그대로 물려받고, 메타데이터
 * JSON 만 새로 핀한다. 그래서 한 건에 IPFS 왕복이 <b>한 번</b>이고 이미지 업로드는 없다.
 *
 * <p>🔴 <b>넣으면 되돌릴 수 없다.</b> 온체인 등록이 나가고 {@code maxSupply} 가 박힌다(첫 장이
 * 나가면 동결). 그래서 <b>모든 항목을 먼저 검증</b>하고 하나라도 어긋나면 아무것도 만들지 않는다.
 * 빼는 것은 삭제가 아니라 {@code draw_pool = false} 로 내리는 것이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NftPhotocardPoolService {

    private static final String METADATA_FILENAME = "photocard-metadata.json";  // 기존 도안 등록과 같은 값
    /** nft_photocard_designs.name 컬럼 폭 (varchar(100), V20260911_1000 참고) */
    private static final int DESIGN_NAME_MAX_LENGTH = 100;

    private final NftPhotocardDesignRepository designRepository;
    private final NftPhotocardTemplateRepository templateRepository;
    private final PerformanceGeneralRepository performanceRepository;
    private final NftMarketQueryRepository queryRepository;
    private final IpfsPinService ipfsPinService;
    private final NftDesignChainWriter writer;
    private final NftDesignChainRegistrar registrar;

    /**
     * 🔴 T4-a: 공연 존재를 확인한다. 없는 performanceId 로 조회하면 designs가 그냥 빈 목록으로
     * 나와 200 + seatCapacity 0 + sufficient true 가 돌아가고, 어드민 화면이 "충분함"을 그리게
     * 된다. {@link #addToPerformance} 는 이미 findById 로 검증하므로 양쪽을 일관되게 맞춘다.
     */
    @Transactional(readOnly = true)
    public NftPerformancePoolResponse findPerformancePool(Long performanceId) {
        if (!performanceRepository.existsById(performanceId)) {
            throw new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND);
        }
        List<NftPhotocardDesignResponse> designs =
                designRepository.findAllByPerformanceIdAndDrawPoolTrueOrderByIdAsc(performanceId).stream()
                        .map(NftPhotocardDesignResponse::from)
                        .toList();
        return NftPerformancePoolResponse.of(
                queryRepository.sumSeatCapacityAcrossSchedules(performanceId), designs);
    }

    /**
     * 체크한 템플릿들을 이 공연의 도안으로 만든다.
     *
     * <p>검증을 전부 먼저 한다 — 되돌릴 수 없어서, 앞의 셋은 체인에 올라가고 넷째에서 거절되는
     * 상태를 만들지 않는다.
     *
     * <p>도안 하나하나는 {@link NftDesignChainWriter} 가 자기 트랜잭션에서 저장하고 온체인 등록은
     * 그 뒤에 나간다. 등록이 실패해도 도안 행은 {@code PENDING} 으로 남아 재시도 API 로 이어 보낼 수
     * 있다 — 기존 도안 등록과 같은 규칙이다.
     */
    public NftPerformancePoolResponse addToPerformance(Long performanceId, NftPoolAddRequest request) {
        PerformanceGeneral performance = performanceRepository.findById(performanceId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PERFORMANCE_NOT_FOUND));

        // 요청 자체만 봐도 알 수 있는 중복은 DB 조회보다 먼저 걸러낸다. DB 유니크 검증만 믿으면
        // 같은 templateId 가 요청 안에서 두 번 오는 경우 둘 다 그 시점엔 DB에 없어 통과해 버리고,
        // 첫 번째 도안이 저장·온체인 등록까지 나간 뒤에야 두 번째 저장에서 유니크 위반으로 터진다.
        Set<Long> requestedTemplateIds = new HashSet<>();
        for (NftPoolAddRequest.Item item : request.items()) {
            if (!requestedTemplateIds.add(item.templateId())) {
                throw new BusinessException(NftErrorCode.TEMPLATE_ALREADY_IN_POOL);
            }
        }

        List<NftPhotocardTemplate> templates = new ArrayList<>();
        for (NftPoolAddRequest.Item item : request.items()) {
            NftPhotocardTemplate template = templateRepository.findById(item.templateId())
                    .orElseThrow(() -> new BusinessException(NftErrorCode.TEMPLATE_NOT_FOUND));
            if (designRepository.existsByPerformanceIdAndTemplateId(performanceId, template.getId())) {
                throw new BusinessException(NftErrorCode.TEMPLATE_ALREADY_IN_POOL);
            }
            // 🔴 C1: 이 이름은 DB 컬럼(100자)에만 들어간다 — 2026-09-21 이후 메타데이터에서는
            // 공연을 뺐다. 그래도 조용히 자르지 않고 거절한다: 잘린 이름이 목록·지갑 화면에
            // 그대로 노출되고 고칠 경로가 없다. 검증 루프에서 미리 본다 — 생성 루프 중간에서
            // 터지면 앞 항목은 이미 온체인에 올라간 뒤다.
            if (designName(template, performance).length() > DESIGN_NAME_MAX_LENGTH) {
                throw new BusinessException(NftErrorCode.DESIGN_NAME_TOO_LONG);
            }
            templates.add(template);
        }

        for (int i = 0; i < templates.size(); i++) {
            createPerformanceDesign(performance, templates.get(i), request.items().get(i).totalSupply());
        }
        return findPerformancePool(performanceId);
    }

    private void createPerformanceDesign(PerformanceGeneral performance, NftPhotocardTemplate template,
                                         int totalSupply) {
        // DB 이름에는 공연을 붙인다 — 어드민·사용자 화면이 보는 값이다
        String name = designName(template, performance);
        /* 🔴 메타데이터에는 공연을 넣지 않는다. 템플릿이 같으면 JSON 바이트가 같아지고,
           같으면 CID 도 같아 공연을 아무리 늘려도 Pinata 파일이 안 늘어난다
           (PhotocardNftMetadata.ofDrawPool 주석). 지갑 표시와 DB 이름이 여기서 갈린다. */
        PhotocardNftMetadata metadata = PhotocardNftMetadata.ofDrawPool(
                template.getName(), template.getDescription(), template.getImageCid(),
                template.getGroupName(), template.getGrade().name());
        String metadataCid = ipfsPinService.pinJson(METADATA_FILENAME, metadata);

        NftPhotocardDesign design = writer.createFromTemplate(
                template.getId(), performance.getId(), name, totalSupply, metadataCid);

        try {
            registrar.register(design.getId(), false);
        } catch (RuntimeException e) {
            log.error("도안은 만들었지만 온체인 등록에 실패했습니다. 재시도할 수 있습니다 designId={}",
                    design.getId(), e);
        }
    }

    /**
     * 체크한 템플릿들을 <b>이벤트 팩이 뽑는 풀</b>에 넣는다. 공연이 없다.
     *
     * <p>이벤트 풀은 <b>하나를 공유</b>한다 — 이벤트 A·B 를 동시에 열어도 같은 도안에서 뽑힌다.
     * 이벤트마다 다른 세트가 필요해지면 이벤트↔도안 연결표를 붙인다.
     */
    public List<NftPhotocardDesignResponse> addToEventPool(NftPoolAddRequest request) {
        // addToPerformance 와 같은 이유로 요청 자체의 중복부터 걸러낸다 — DB 조회만 믿으면 같은
        // templateId 가 요청 안에서 두 번 올 때 첫 도안이 저장·온체인 등록까지 나간 뒤에야
        // 두 번째 저장에서 유니크 위반으로 터진다.
        Set<Long> requestedTemplateIds = new HashSet<>();
        for (NftPoolAddRequest.Item item : request.items()) {
            if (!requestedTemplateIds.add(item.templateId())) {
                throw new BusinessException(NftErrorCode.TEMPLATE_ALREADY_IN_POOL);
            }
        }

        List<NftPhotocardTemplate> templates = new ArrayList<>();
        for (NftPoolAddRequest.Item item : request.items()) {
            NftPhotocardTemplate template = templateRepository.findById(item.templateId())
                    .orElseThrow(() -> new BusinessException(NftErrorCode.TEMPLATE_NOT_FOUND));
            if (designRepository.existsByPerformanceIdIsNullAndTemplateId(template.getId())) {
                throw new BusinessException(NftErrorCode.TEMPLATE_ALREADY_IN_POOL);
            }
            templates.add(template);
        }

        List<NftPhotocardDesignResponse> created = new ArrayList<>();
        for (int i = 0; i < templates.size(); i++) {
            created.add(createEventPoolDesign(templates.get(i), request.items().get(i).totalSupply()));
        }
        return created;
    }

    /**
     * 도안을 풀에서 빼거나 다시 넣는다. <b>삭제가 아니다</b> — 온체인 등록은 되돌릴 수 없고
     * 이미 발행된 카드도 사라지지 않는다. 앞으로 뽑히지 않게 되는 것뿐이다.
     *
     * <p>이벤트 풀 도안(공연 없음)은 내릴 수 없다 — 공연도 없고 풀도 아닌 행이 되어 CHECK 에 걸린다.
     *
     * <p>🔴 반대로 <b>올릴 때</b>는 {@code chk_nft_photocard_designs_pool_attrs} 가 소속·등급을
     * 요구한다. 기존 경로({@link NftPhotocardDesign#create})로 만든 공연 전용 도안은 둘 다 NULL이라,
     * 엔티티를 먼저 바꾸면 flush 시점에 {@code DataIntegrityViolationException}(500)이 난다.
     * 그래서 {@link NftPhotocardDesign#changeDrawPool} 을 부르기 <b>전에</b> 검증한다 — 순서가
     * 바뀌면 더티 상태가 남아 이 메서드가 끝난 뒤 flush 에서 터진다(C2).
     */
    @Transactional
    public NftPhotocardDesignResponse changeDrawPool(Long designId, boolean drawPool) {
        NftPhotocardDesign design = designRepository.findById(designId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DESIGN_NOT_FOUND));
        if (!drawPool && design.isEventPool()) {
            throw new BusinessException(NftErrorCode.DESIGN_EVENT_POOL_NOT_REMOVABLE);
        }
        if (drawPool && (design.getGroupName() == null || design.getGrade() == null)) {
            throw new BusinessException(NftErrorCode.DESIGN_POOL_ATTRIBUTES_REQUIRED);
        }
        design.changeDrawPool(drawPool);
        return NftPhotocardDesignResponse.from(design);
    }

    /** 공연 도안 이름. {@code "{템플릿 이름} · {공연 제목}"} — 규칙을 바꾸면 이미 핀된 도안과 어긋난다 */
    private String designName(NftPhotocardTemplate template, PerformanceGeneral performance) {
        return template.getName() + " · " + performance.getTitle();
    }

    /** 이벤트 풀 도안. 이름에 공연이 붙지 않고 attribute 도 소속·등급 둘이다 */
    private NftPhotocardDesignResponse createEventPoolDesign(NftPhotocardTemplate template,
                                                             int totalSupply) {
        PhotocardNftMetadata metadata = PhotocardNftMetadata.ofDrawPool(
                template.getName(), template.getDescription(), template.getImageCid(),
                template.getGroupName(), template.getGrade().name());
        String metadataCid = ipfsPinService.pinJson(METADATA_FILENAME, metadata);

        NftPhotocardDesign design = writer.createFromTemplate(
                template.getId(), null, template.getName(), totalSupply, metadataCid);

        try {
            registrar.register(design.getId(), false);
        } catch (RuntimeException e) {
            log.error("이벤트 풀 도안은 만들었지만 온체인 등록에 실패했습니다. 재시도할 수 있습니다 designId={}",
                    design.getId(), e);
        }
        return NftPhotocardDesignResponse.from(
                designRepository.findById(design.getId()).orElseThrow());
    }
}
