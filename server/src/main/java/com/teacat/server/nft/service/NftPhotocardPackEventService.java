package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftPhotocardPackEventCreateRequest;
import com.teacat.server.nft.dto.response.NftPhotocardPackEventResponse;
import com.teacat.server.nft.entity.NftPhotocardPackEvent;
import com.teacat.server.nft.entity.NftPhotocardPackSource;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardPackEventRepository;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 카드팩 이벤트 관리 (어드민).
 *
 * <p>지급 판정 자체는 {@link NftPhotocardDrawWriter#claimEventPack} 이 하고, 여기는 그 판정이
 * 읽을 행을 만들고 여닫기만 한다.
 */
@Service
@RequiredArgsConstructor
public class NftPhotocardPackEventService {

    private final NftPhotocardPackEventRepository eventRepository;
    private final NftPhotocardPackRepository packRepository;

    @Transactional
    public NftPhotocardPackEventResponse create(NftPhotocardPackEventCreateRequest request) {
        if (eventRepository.existsByCode(request.code())) {
            throw new BusinessException(NftErrorCode.PACK_EVENT_CODE_DUPLICATED);
        }
        NftPhotocardPackEvent saved = eventRepository.save(NftPhotocardPackEvent.create(
                request.code(), request.name(), request.startsAt(), request.endsAt()));

        // 방금 만든 이벤트라 지급 수는 0이다
        return NftPhotocardPackEventResponse.of(saved, LocalDateTime.now(), 0L);
    }

    @Transactional(readOnly = true)
    public List<NftPhotocardPackEventResponse> findAll() {
        // 지급 수는 이벤트마다 세지 않고 한 번에 집계한다 (N+1 방지)
        Map<String, Long> granted = packRepository
                .countGroupedBySourceRef(NftPhotocardPackSource.EVENT).stream()
                .collect(Collectors.toMap(row -> (String) row[0], row -> (Long) row[1]));

        LocalDateTime now = LocalDateTime.now();
        return eventRepository.findAllByOrderByIdDesc().stream()
                .map(event -> NftPhotocardPackEventResponse.of(
                        event, now, granted.getOrDefault(event.getCode(), 0L)))
                .toList();
    }

    @Transactional
    public NftPhotocardPackEventResponse changeActive(Long eventId, boolean active) {
        NftPhotocardPackEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PACK_EVENT_NOT_FOUND));
        event.changeActive(active);

        long grantedCount = packRepository.countBySourceAndSourceRef(
                NftPhotocardPackSource.EVENT, event.getCode());
        return NftPhotocardPackEventResponse.of(event, LocalDateTime.now(), grantedCount);
    }
}
