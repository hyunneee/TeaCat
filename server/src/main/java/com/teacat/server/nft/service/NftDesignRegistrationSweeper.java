package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftDesignProperties;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 보내둔 도안 등록 트랜잭션이 확정됐는지 주기적으로 확인한다.
 *
 * <p>블록체인 API 는 등록 요청에 {@code 202} 와 txHash 만 돌려준다 — 체인에 실렸는지는 그때 알 수 없다.
 * 이걸 확인하는 사람이 없으면 도안이 <b>영원히 REGISTERING 으로 남고</b>, 어드민은 등록이 됐는지
 * 안 됐는지 알 수 없다. (blockchain/DESIGN.md 4-2)
 *
 * <p>확정의 진실은 {@link NftDesignChainRegistrar#confirm} 에 있고 이 클래스는 대상만 고른다.
 * 한 건이 실패해도 다음 건을 계속하고, 실패한 건은 REGISTERING 으로 남아 다음 주기에 다시 잡힌다.
 *
 * <p>등록 기록은 멱등이라 인스턴스가 여러 개여도 락 라이브러리가 필요 없다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nft.design", name = "confirm-enabled", havingValue = "true", matchIfMissing = true)
public class NftDesignRegistrationSweeper {

    private final NftPhotocardDesignRepository designRepository;
    private final NftDesignChainRegistrar registrar;
    private final NftDesignProperties properties;

    @Scheduled(fixedDelayString = "${nft.design.confirm-interval}")
    public void sweep() {
        for (Long designId : designRepository.findRegisteringIds(properties.confirmBatchSize())) {
            try {
                String txHash = designRepository.findById(designId)
                        .map(NftPhotocardDesign::getRegisterTxHash)
                        .orElse(null);
                registrar.confirm(designId, txHash);
            } catch (RuntimeException e) {
                // 블록체인 서비스가 잠깐 죽은 것과 트랜잭션 실패는 다르다. 확정하지 않고 다음 주기에 다시 본다
                log.warn("도안 등록 확정 확인 실패 designId={}", designId, e);
            }
        }
    }
}
