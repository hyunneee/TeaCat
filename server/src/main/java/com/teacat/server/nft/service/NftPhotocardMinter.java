package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardChainClient.IssueItem;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.nft.repository.NftMarketQueryRepository.PendingMintRow;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 아직 체인에 안 보낸 카드를 발행 요청으로 밀어 넣는다.
 *
 * <p><b>트랜잭션을 열지 않는다.</b> 한 배치가 체인에 다녀오는 데 블록 하나(SSAFY 체인은 10초)가
 * 걸리고, 공연 하나에 배치가 여러 개다. 그동안 DB 커넥션을 쥐고 있으면 풀이 마른다.
 *
 * <p><b>보낸 뒤에 이 클래스가 DB 에 쓰는 것은 없다.</b> 블록체인 서비스가 요청을 받은 자리에서
 * {@code nft_photocards} 를 {@code MINTING} 으로 옮기고, 확정되면 {@code MINTED} 로 바꾼다
 * (blockchain/DESIGN.md 1장 예외). Spring 이 같은 컬럼을 또 쓰면 서로 덮어쓴다.
 *
 * <h3>재시도가 안전한 이유</h3>
 * {@code photocardKey} 가 {@code nft_photocards.issue_key} 라 영구히 유일하고, 컨트랙트가 이미 발행된
 * 키를 <b>revert 가 아니라 건너뛴다.</b> 응답을 못 받아 다시 보내도 카드가 두 장 나가지 않는다.
 * 게다가 대상은 {@code PENDING} 행만이라, 이미 보낸 {@code MINTING} 은 다시 잡히지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftPhotocardMinter {

    /**
     * 한 요청에 담을 최대 장수. 컨트랙트의 {@code MAX_BATCH} 와 같은 값이다 —
     * 넘겨 보내면 블록체인 API 가 400 으로 돌려보낸다.
     */
    private static final int MAX_BATCH = 200;

    /** 한 번의 재시도로 훑을 최대 카드 수. 공연 하나가 커도 요청 하나가 무한히 길어지지 않게 한다 */
    private static final int SWEEP_LIMIT = 2_000;

    private final NftMarketQueryRepository queryRepository;
    private final PhotocardChainClient chainClient;

    /**
     * 이 공연의 {@code PENDING} 카드를 전부 체인으로 보낸다.
     *
     * <p>배치 하나가 실패하면 <b>거기서 멈춘다.</b> 계속 밀어붙여도 같은 이유로 실패할
     * 가능성이 높고(체인이 죽었거나 도안이 미등록), 성공한 앞 배치는 이미 {@code MINTING} 이라
     * 다음 재시도에 다시 잡히지 않는다.
     *
     * @return 체인으로 보낸 카드 수
     */
    public int mintPending(Long performanceId) {
        return send("performanceId=" + performanceId,
                queryRepository.findPendingMints(performanceId, SWEEP_LIMIT));
    }

    /**
     * {@link #mintPending} 의 회차 스코프 버전. 이 회차 티켓의 {@code PENDING} 카드만 보낸다.
     * 자동 발급 스케줄러가 "회차 시작 1시간 전" 에 만든 카드를 이어서 체인으로 밀어 넣는 경로다.
     */
    public int mintPendingForSchedule(Long scheduleId) {
        return send("scheduleId=" + scheduleId,
                queryRepository.findPendingMintsForSchedule(scheduleId, SWEEP_LIMIT));
    }

    /**
     * 뽑기 직후 그 카드 한 장을 보낸다. 트랜잭션 밖에서 부른다.
     *
     * <p>실패하면 예외가 그대로 나간다 — 부르는 쪽({@link NftPhotocardDrawService})이 삼키고
     * 카드는 PENDING 으로 남아 {@link #mintPendingDraws} 가 다음 주기에 다시 보낸다.
     */
    public void mintDrawn(Long photocardId, String issueKey, Long designId,
                          String chainTokenId, String address) {
        chainClient.issuePhotocards(List.of(
                new IssueItem(issueKey, chainTokenId, address, photocardId, designId)));
        log.info("뽑기 포토카드 발행 요청 photocardId={}", photocardId);
    }

    /** 체인에 못 보낸 뽑기 카드(티켓 없는 PENDING)를 이어서 보낸다. 스위퍼가 부른다 */
    public int mintPendingDraws(int limit) {
        return send("draw", queryRepository.findPendingDrawMints(Math.min(limit, SWEEP_LIMIT)));
    }

    private int send(String scope, List<PendingMintRow> rows) {
        if (rows.isEmpty()) {
            return 0;
        }

        int sent = 0;
        for (List<PendingMintRow> batch : chunk(rows)) {
            List<IssueItem> items = batch.stream()
                    .map(row -> new IssueItem(
                            row.issueKey(),
                            row.chainTokenId().toPlainString(),
                            row.address(),
                            row.photocardId(),
                            row.designId()))
                    .toList();

            chainClient.issuePhotocards(items);
            sent += items.size();
            log.info("포토카드 발행 요청 {} {}건 (누적 {}/{})", scope, items.size(), sent, rows.size());
        }

        return sent;
    }

    private static List<List<PendingMintRow>> chunk(List<PendingMintRow> rows) {
        List<List<PendingMintRow>> batches = new ArrayList<>();
        for (int start = 0; start < rows.size(); start += MAX_BATCH) {
            batches.add(rows.subList(start, Math.min(start + MAX_BATCH, rows.size())));
        }
        return batches;
    }
}
