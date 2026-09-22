package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.response.NftPhotocardDrawResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDrawStatusResponse;
import com.teacat.server.nft.dto.response.NftPhotocardPackClaimResponse;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.service.NftPhotocardDrawWriter.DrawOutcome;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 뽑기 — 트랜잭션(writer)과 체인 전송(minter)의 순서를 안다.
 *
 * <pre>
 * ① writer.draw       팩 소비 · 도안 무작위 · 카드행 PENDING · 멱등키    (트랜잭션)
 * ② minter.mintDrawn  그 한 장을 체인으로                              (트랜잭션 밖, 실패는 삼킴)
 * </pre>
 *
 * <p>②가 실패해도 ①을 되돌리지 않는다. 카드는 이미 사용자 것이고 {@link NftPhotocardDrawSweeper} 가
 * 이어 보낸다. 되돌리면 팩만 돌아오고 카드 행은 고아가 된다. {@link NftPhotocardIssuer} 와 같은 판단이다.
 *
 * <p>이 클래스는 트랜잭션을 열지 않는다 — 체인에 다녀오는 동안 커넥션을 쥐면 안 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NftPhotocardDrawService {

    private final NftPhotocardDrawWriter writer;
    private final NftPhotocardMinter minter;

    public NftPhotocardDrawStatusResponse status(Long userId) {
        NftPhotocardDrawWriter.PackCounts counts = writer.counts(userId);
        /* 개수는 `counts` 가, 팩별 개봉 시각은 `packs` 가 답한다. 두 조회 사이에 팩이 열려도
           다음 조회가 바로잡으므로 한 트랜잭션으로 묶지 않는다 — 화면은 `packs` 의 `openable` 로 그린다. */
        List<NftPhotocardDrawStatusResponse.Pack> packs = writer.packs(userId).stream()
                .map(pack -> new NftPhotocardDrawStatusResponse.Pack(
                        pack.packId(), pack.source(), pack.title(), pack.openAt(),
                        NftPhotocardDrawStatusResponse.PackStatus.valueOf(pack.status().name()),
                        pack.status() == NftPhotocardDrawWriter.PackStatus.OPENABLE))
                .toList();
        return new NftPhotocardDrawStatusResponse(
                counts.openable() > 0, counts.openable(), counts.scheduled(), counts.preparing(),
                counts.nextOpenAt(), packs);
    }

    public NftPhotocardDrawResponse draw(Long userId, String idempotencyKeyHeader) {
        UUID key = NftRequestSupport.parseIdempotencyKey(idempotencyKeyHeader);

        DrawOutcome outcome = drawWithContentionRetry(userId, key);

        if (!outcome.replayed()) {
            try {
                minter.mintDrawn(outcome.photocardId(), outcome.issueKey(), outcome.designId(),
                        outcome.chainTokenId(), outcome.walletAddress());
            } catch (RuntimeException e) {
                log.error("뽑기 카드는 만들었지만 체인 발행 요청에 실패했습니다. 스위퍼가 재시도합니다 photocardId={}",
                        outcome.photocardId(), e);
            }
        }

        return new NftPhotocardDrawResponse(outcome.photocardId(), outcome.designName(), outcome.imageUrl(),
                outcome.group(), outcome.grade(), outcome.issuedAt());
    }

    /**
     * {@code SKIP LOCKED} 때문에 후보가 잠깐 안 보인 경우만 새 트랜잭션으로 다시 시도한다.
     * 재고 없음·지갑 없음 같은 확정 오류는 그대로 돌려준다.
     */
    private DrawOutcome drawWithContentionRetry(Long userId, UUID key) {
        final int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return writer.draw(userId, key);
            } catch (DataIntegrityViolationException e) {
                // 같은 키가 동시에 두 번 왔다. 먼저 커밋된 쪽의 카드를 돌려준다
                return writer.findReplay(userId, key).orElseThrow(() -> e);
            } catch (BusinessException e) {
                if (e.getErrorCode() != NftErrorCode.DRAW_POOL_BUSY || attempt == maxAttempts) {
                    throw e;
                }
                log.info("카드팩 도안 잠금 경합 재시도 userId={} attempt={}", userId, attempt + 1);
            }
        }
        throw new IllegalStateException("unreachable");
    }

    public NftPhotocardPackClaimResponse claimEventPack(Long userId) {
        boolean granted;
        try {
            granted = writer.claimEventPack(userId);
        } catch (DataIntegrityViolationException e) {
            // 존재 확인과 INSERT 사이에 같은 요청이 먼저 들어갔다. 이미 받은 것이다
            granted = false;
        }
        return new NftPhotocardPackClaimResponse(granted, writer.counts(userId).openable());
    }
}
