package com.teacat.server.resale.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.teacat.server.resale.exception.ResaleErrorCode;
import com.teacat.server.wallet.client.BlockchainRestClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * 취소표 추첨이 블록체인 서비스({@code /internal/draws})에 묻는 것들.
 *
 * <p>VerifiableDraw 는 원래 포토카드 도안 배정용이라 입력 이름이 {@code ticketIds · designIds ·
 * quantities} 다. 여기서는 이렇게 읽는다:
 *
 * <pre>
 *   ticketIds   = 참가자(resale_entries.id), 오름차순
 *   designIds   = 순위 1 … N
 *   quantities  = 전부 1
 * </pre>
 *
 * 순위 N개를 참가자 N명에게 한 장씩 배정하면 그것이 곧 <b>순열</b>이고, 당첨 순서다.
 * 배정 함수는 난수로부터 계산되는 순수 함수라 누구나 같은 순위를 다시 얻을 수 있다.
 * (PHOTOCARD_PLAN.md 4장, 컨트랙트는 한 줄도 안 바뀐다)
 */
@Component
@RequiredArgsConstructor
public class ResaleDrawChainClient {

    private static final String OPEN_PATH = "/internal/draws/open";
    private static final String DRAW_PATH = "/internal/draws/";

    private final BlockchainRestClient blockchainRestClient;

    /** 커밋. {@code 202} 와 txHash 가 온다 — 리빌은 블록체인 서비스가 다음 블록에 자동으로 한다 */
    public DrawOpenResult openDraw(String drawKey, Long performanceId, List<Long> participantIds) {
        Map<String, Object> body = new LinkedHashMap<>(inputsOf(performanceId, participantIds));
        body.put("drawKey", drawKey);
        return blockchainRestClient.post(OPEN_PATH, body, DrawOpenResult.class,
                ResaleErrorCode.DRAW_CHAIN_FAILED);
    }

    /** 열린 적 없어도 200 에 {@code exists=false} 다 */
    public DrawStateResult state(String drawKey) {
        return blockchainRestClient.get(DRAW_PATH + drawKey, Map.of(), DrawStateResult.class,
                ResaleErrorCode.DRAW_CHAIN_FAILED);
    }

    /**
     * 확정된 난수로 순위를 계산한다. 트랜잭션이 없고 멱등이다.
     *
     * <p>입력을 다시 보내는 것이 곧 검사다 — 블록체인 서비스가 inputsHash 를 다시 계산해 체인과 대조하므로,
     * 커밋 이후 참가자 목록이 바뀌었으면 {@code INPUTS_MISMATCH} 로 거절된다.
     *
     * @return 당첨 순서대로 정렬된 참가자 id
     */
    public Ranking rank(String drawKey, Long performanceId, List<Long> participantIds) {
        DrawAssignResult result = blockchainRestClient.post(
                DRAW_PATH + drawKey + "/assign", inputsOf(performanceId, participantIds),
                DrawAssignResult.class, ResaleErrorCode.DRAW_CHAIN_FAILED);

        List<Long> ordered = result.assignments().stream()
                .sorted(Comparator.comparing(a -> Long.valueOf(a.designId())))
                .map(a -> Long.valueOf(a.ticketId()))
                .toList();
        return new Ranking(result.randomness(), ordered);
    }

    private static Map<String, Object> inputsOf(Long performanceId, List<Long> participantIds) {
        int n = participantIds.size();
        Map<String, Object> inputs = new LinkedHashMap<>();
        // bigint 라 JSON number 로 주고받으면 큰 값에서 정밀도가 깨진다. 문자열로 보낸다
        inputs.put("performanceId", performanceId.toString());
        inputs.put("ticketIds", participantIds.stream().map(String::valueOf).toList());
        inputs.put("designIds", IntStream.rangeClosed(1, n).mapToObj(String::valueOf).toList());
        inputs.put("quantities", IntStream.rangeClosed(1, n).mapToObj(i -> "1").toList());
        return inputs;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DrawOpenResult(String status, String txHash, String drawId, String inputsHash) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DrawStateResult(boolean exists, String status, Integer commitBlock, Integer targetBlock,
                                  boolean revealable, String randomness, String inputsHash) {
        public boolean isRevealed() {
            return exists && "REVEALED".equals(status) && randomness != null;
        }

        public boolean isCanceled() {
            return exists && "CANCELED".equals(status);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DrawAssignResult(String randomness, List<Assignment> assignments) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Assignment(String ticketId, String designId) {
    }

    public record Ranking(String randomness, List<Long> orderedParticipantIds) {
    }
}
