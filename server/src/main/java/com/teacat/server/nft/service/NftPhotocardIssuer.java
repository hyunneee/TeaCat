package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.exception.NftErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 포토카드 발급 — DB 행을 만들고 체인으로 보낸다.
 *
 * <pre>
 * ① 카드 행 생성   티켓마다 한 장, 도안은 무작위 배정, wallet_id 까지   (트랜잭션)
 * ② 발행 요청      PENDING 행을 200장씩 잘라 체인으로                 (트랜잭션 밖)
 * </pre>
 *
 * <p><b>두 단계를 갈라 놓은 이유가 둘이다.</b>
 *
 * <p>하나는 트랜잭션이다. ②가 체인에 다녀오는 동안 ①의 트랜잭션이 열려 있으면, 공연 하나에
 * 수백 장인 배치가 커넥션을 수십 초씩 붙잡는다.
 *
 * <p>다른 하나는 <b>②가 실패해도 ①을 되돌리면 안 되기 때문</b>이다. 카드 행은 남겨두고 발행만
 * 다시 보내면 된다 — 도안 등록에서와 같은 판단이다. 되돌리면 어드민이 발급을 다시 눌러야 하는데,
 * {@code existsByDesignPerformanceId} 가 재발급을 막고 있어 손쓸 방법이 없어진다.
 *
 * <p>그래서 ②만 다시 부르는 경로({@code mintPending})를 따로 연다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NftPhotocardIssuer {

    private final NftService nftService;
    private final NftPhotocardMinter minter;

    /**
     * 발급하고 곧바로 체인에 보낸다.
     *
     * <p>체인 전송이 실패해도 <b>카드 행은 남는다.</b> 응답의 {@code failedCount} 가 0 이 아니면
     * 그만큼 아직 안 나갔다는 뜻이고, 발행 재시도로 이어 보내면 된다.
     */
    public NftPhotocardIssueResponse issue(Long performanceId, NftPhotocardIssueRequest request) {
        NftPhotocardIssueResponse created = nftService.issuePhotocards(performanceId, request);

        int sent = 0;
        try {
            sent = minter.mintPending(performanceId);
        } catch (RuntimeException e) {
            log.error("카드는 만들었지만 체인 발행에 실패했습니다. 재시도할 수 있습니다 performanceId={}",
                    performanceId, e);
        }

        return new NftPhotocardIssueResponse(created.issuedCount(), created.issuedCount() - sent);
    }

    /**
     * 회차 하나를 자동 발급하고 곧바로 체인에 보낸다. <b>스케줄러가 부른다.</b>
     *
     * <p>{@link #issue} 와 흐름은 같지만 대상이 회차(performance_detail)다. 체인 전송이 실패해도
     * 카드 행은 PENDING 으로 남고, 다음 스케줄러 주기가 {@code mintPendingForSchedule} 로 이어 보낸다.
     * 이미 발급된 회차면 {@code issuePhotocardsForSchedule} 이 조용히 0 을 돌려준다(예외 아님).
     */
    public NftPhotocardIssueResponse issueForSchedule(Long scheduleId) {
        NftPhotocardIssueResponse created = nftService.issuePhotocardsForSchedule(scheduleId);

        int sent = 0;
        try {
            sent = minter.mintPendingForSchedule(scheduleId);
        } catch (RuntimeException e) {
            log.error("회차 카드는 만들었지만 체인 발행에 실패했습니다. 다음 주기가 재시도합니다 scheduleId={}",
                    scheduleId, e);
        }

        return new NftPhotocardIssueResponse(created.issuedCount(), created.issuedCount() - sent);
    }

    /**
     * 아직 안 보낸 카드를 이어서 보낸다. 발급은 그대로 두고 발행만 다시 하는 경로다.
     *
     * <p>여기서는 예외를 삼키지 않는다 — 어드민이 직접 누른 요청이라 실패를 알아야 한다.
     */
    public NftPhotocardIssueResponse mintPending(Long performanceId) {
        int sent = minter.mintPending(performanceId);

        if (sent == 0) {
            throw new BusinessException(NftErrorCode.NO_PENDING_PHOTOCARDS);
        }

        return new NftPhotocardIssueResponse(sent, 0);
    }
}
