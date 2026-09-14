package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.nft.dto.request.NftPhotocardTemplateCreateRequest;
import com.teacat.server.nft.dto.response.NftPhotocardTemplateResponse;
import com.teacat.server.nft.entity.NftPhotocardTemplate;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 포토카드 템플릿 관리 (어드민).
 *
 * <p><b>이미지 핀 한 번이 전부다.</b> 메타데이터 핀도 온체인 등록도 하지 않는다 — 수량이 없어서
 * 등록할 값이 없다. 그 둘은 이 템플릿을 공연·이벤트에 넣을 때
 * {@link NftPhotocardPoolService} 가 한다.
 */
@Service
@RequiredArgsConstructor
public class NftPhotocardTemplateService {

    private final NftPhotocardTemplateRepository templateRepository;
    private final IpfsPinService ipfsPinService;

    // 🔴 C5: @Transactional 을 떼었다. pinImage(IPFS 핀)를 트랜잭션 안에서 기다리고 있었다 —
    // 이 프로젝트 규칙은 "핀·체인은 트랜잭션 밖" 이고, 저장이 save() 단일 호출이라
    // Spring Data 의 자체 트랜잭션으로 충분해 이 메서드에 트랜잭션이 필요 없다.
    public NftPhotocardTemplateResponse create(NftPhotocardTemplateCreateRequest request) {
        String imageCid = ipfsPinService.pinImage(request.image());
        // ipfs:// 는 브라우저가 못 연다. 화면 코드가 그대로 쓰도록 게이트웨이 주소를 넣는다
        String imageUrl = ipfsPinService.gatewayUrl(imageCid);

        NftPhotocardTemplate saved = templateRepository.save(NftPhotocardTemplate.create(
                request.name().trim(), request.description(), imageCid, imageUrl,
                request.group().trim(), request.grade()));

        // 방금 만든 템플릿이라 쓰인 곳이 없다
        return NftPhotocardTemplateResponse.of(saved, 0L);
    }

    @Transactional(readOnly = true)
    public List<NftPhotocardTemplateResponse> findAll() {
        // 템플릿마다 세지 않고 한 번에 집계한다 (N+1 방지)
        Map<Long, Long> used = usedCounts();

        return templateRepository.findAllByHiddenFalseOrderByIdDesc().stream()
                .map(template -> NftPhotocardTemplateResponse.of(
                        template, used.getOrDefault(template.getId(), 0L)))
                .toList();
    }

    @Transactional
    public NftPhotocardTemplateResponse changeHidden(Long templateId, boolean hidden) {
        NftPhotocardTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TEMPLATE_NOT_FOUND));
        template.changeHidden(hidden);
        return NftPhotocardTemplateResponse.of(
                template, usedCounts().getOrDefault(templateId, 0L));
    }

    private Map<Long, Long> usedCounts() {
        return templateRepository.countDesignsGroupedByTemplate().stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
    }
}
