package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.client.ChainTxReport;
import com.teacat.server.nft.client.PhotocardDesignRegisterResult;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 도안의 온체인 등록 상태를 쓰는 <b>트랜잭션 단위</b>들.
 *
 * <p>여기에는 <b>외부 호출이 없다.</b> 핀도 체인도 부르지 않는다 — 네트워크를 기다리는 동안
 * DB 트랜잭션이 열려 있으면 커넥션 풀이 마른다. 순서를 아는 쪽은
 * {@link NftDesignChainRegistrar} 이고, 여기는 그 결과를 받아 적기만 한다.
 *
 * <p>모든 메서드가 행을 잠그고 읽는다. 상태를 바꾸는 경로가 셋이기 때문이다 —
 * 도안 생성 · 어드민 재시도 · 확정 감시.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftDesignChainWriter {

    private final NftPhotocardDesignRepository designRepository;

    /** 등록 요청에 실어 보낼 값. 이걸 꺼낸 뒤에는 트랜잭션 없이 체인을 부른다 */
    public record RegistrationTarget(Long designId, int maxSupply, String metadataCid) {
    }

    @Transactional
    public NftPhotocardDesign create(Long performanceId, String name, String imageUrl, int totalSupply,
                                     String imageCid, String metadataCid) {
        return designRepository.save(
                NftPhotocardDesign.create(performanceId, name, imageUrl, totalSupply, imageCid, metadataCid));
    }

    /**
     * 보낼 수 있는 상태인지 보고 요청 값을 꺼낸다.
     *
     * @param force 확정을 기다리는 중(REGISTERING)이어도 다시 보낼지. 감시가 드롭을 판정하지 못해
     *              멈춰 있을 때 어드민이 손으로 밀어 넣는 용도다. 등록은 멱등이라 안전하다
     */
    @Transactional
    public RegistrationTarget claim(Long designId, boolean force) {
        NftPhotocardDesign design = lock(designId);

        // 첫 장이 나가면 온체인 값이 동결된다. 확정된 도안은 다시 보낼 이유가 없다
        if (design.isRegistered()) {
            throw new BusinessException(NftErrorCode.DESIGN_ALREADY_REGISTERED);
        }
        if (design.isRegistering() && !force) {
            throw new BusinessException(NftErrorCode.DESIGN_REGISTRATION_IN_PROGRESS);
        }
        if (!design.hasPins()) {
            throw new BusinessException(NftErrorCode.DESIGN_PINS_MISSING);
        }

        return new RegistrationTarget(design.getId(), design.getTotalSupply(), design.getMetadataCid());
    }

    /**
     * 등록 응답을 기록한다.
     *
     * <p>{@code ALREADY_DONE} 은 새 트랜잭션 없이 "이미 체인에 있다" 는 답이라 <b>기다릴 것이 없다</b> —
     * 곧바로 REGISTERED 다. {@code PENDING} 은 방금 보냈다는 뜻이라 확정 감시에 넘긴다.
     */
    @Transactional
    public void applyRegisterResult(Long designId, PhotocardDesignRegisterResult result,
                                    Integer chainId, String contractAddress) {
        NftPhotocardDesign design = lock(designId);

        /* force 재요청을 보내는 사이 확정 감시가 먼저 끝냈을 수 있다. 그대로 덮어쓰면 이미 체인에
           올라간 도안이 REGISTERING 으로 되돌아가 "등록됐는데 안 됐다고 말하는" 행이 된다 */
        if (design.isRegistered()) {
            log.info("도안이 이미 등록 확정 상태입니다. 응답을 덮어쓰지 않습니다 designId={}", designId);
            return;
        }

        if (result.isAlreadyDone()) {
            design.markRegistered(result.txHash(), chainId, contractAddress, LocalDateTime.now());
            log.info("도안 등록 확인 (이미 등록돼 있었음) designId={}", designId);
            return;
        }

        design.markRegistering(result.txHash(), chainId, contractAddress);
        log.info("도안 등록 요청 designId={} tx={}", designId, result.txHash());
    }

    /**
     * 요청을 보내지 못했다. <b>도안 행은 지우지 않는다</b> — 핀은 이미 끝났으므로 등록만 다시 보내면 된다.
     */
    @Transactional
    public void applyRegisterNotSent(Long designId) {
        NftPhotocardDesign design = lock(designId);

        /* 이미 보내둔 트랜잭션이 있으면 건드리지 않는다. force 재요청이 실패한 경우인데, 여기서
           txHash 를 지우면 먼저 나간 트랜잭션이 확정돼도 감시가 그 해시를 찾지 못한다 */
        if (design.getRegisterTxHash() != null) {
            log.warn("도안 등록 재요청 실패. 먼저 보낸 트랜잭션은 그대로 둡니다 designId={} tx={}",
                    designId, design.getRegisterTxHash());
            return;
        }

        design.markRegistrationNotSent();
        log.warn("도안 등록 요청 실패. PENDING 으로 남깁니다 designId={}", designId);
    }

    /**
     * 확정 조회 결과를 반영한다.
     *
     * @return 이 호출로 상태가 끝났으면(REGISTERED 또는 FAILED) true. PENDING 이면 false
     */
    @Transactional
    public boolean applyTxReport(Long designId, ChainTxReport report) {
        NftPhotocardDesign design = lock(designId);

        // 감시가 도는 사이 재시도가 먼저 끝냈을 수 있다
        if (!design.isRegistering()) {
            return true;
        }

        if (report.isSettled()) {
            design.markRegistered(report.txHash(), design.getChainId(), design.getContractAddress(),
                    LocalDateTime.now());
            log.info("도안 등록 확정 designId={} tx={}", designId, report.txHash());
            return true;
        }

        if (report.isFailed()) {
            design.markRegistrationFailed();
            log.error("도안 등록이 체인에서 거부됐습니다 designId={} tx={}", designId, report.txHash());
            return true;
        }

        return false;
    }

    private NftPhotocardDesign lock(Long designId) {
        return designRepository.findByIdForUpdate(designId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DESIGN_NOT_FOUND));
    }
}
