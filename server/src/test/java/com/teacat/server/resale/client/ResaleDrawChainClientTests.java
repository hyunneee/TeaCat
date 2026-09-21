package com.teacat.server.resale.client;

import com.teacat.server.common.exception.ErrorCode;
import com.teacat.server.resale.client.ResaleDrawChainClient.Assignment;
import com.teacat.server.resale.client.ResaleDrawChainClient.DrawAssignResult;
import com.teacat.server.resale.client.ResaleDrawChainClient.DrawOpenResult;
import com.teacat.server.resale.client.ResaleDrawChainClient.Ranking;
import com.teacat.server.wallet.client.BlockchainRestClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * 취소표 추첨이 VerifiableDraw 입력을 어떻게 채우는지. 여기가 어긋나면 커밋이 체인에 남은 뒤
 * 배정 단계에서 INPUTS_MISMATCH 로 떨어져 그 추첨을 통째로 버려야 한다.
 */
@ExtendWith(MockitoExtension.class)
class ResaleDrawChainClientTests {

    @Mock
    private BlockchainRestClient restClient;

    @Test
    @SuppressWarnings("unchecked")
    void 참가자는_ticketIds_순위는_designIds_수량은_전부_1로_보낸다() {
        ResaleDrawChainClient client = new ResaleDrawChainClient(restClient);
        given(restClient.post(eq("/internal/draws/open"), any(), eq(DrawOpenResult.class), any(ErrorCode.class)))
                .willReturn(new DrawOpenResult("PENDING", "0xtx", "0xid", "0xinputs"));

        client.openDraw("resale:p7:d45:s1024:n1", 7L, List.of(101L, 105L, 230L));

        ArgumentCaptor<Object> body = ArgumentCaptor.forClass(Object.class);
        verify(restClient).post(eq("/internal/draws/open"), body.capture(), eq(DrawOpenResult.class),
                any(ErrorCode.class));
        Map<String, Object> sent = (Map<String, Object>) body.getValue();

        assertThat(sent).containsEntry("drawKey", "resale:p7:d45:s1024:n1");
        assertThat(sent).containsEntry("performanceId", "7");
        assertThat(sent.get("ticketIds")).isEqualTo(List.of("101", "105", "230"));
        assertThat(sent.get("designIds")).isEqualTo(List.of("1", "2", "3"));
        assertThat(sent.get("quantities")).isEqualTo(List.of("1", "1", "1"));
    }

    @Test
    void 배정_결과를_순위_순서의_참가자_목록으로_바꾼다() {
        ResaleDrawChainClient client = new ResaleDrawChainClient(restClient);
        given(restClient.post(eq("/internal/draws/resale:p7:d45:s1024:n1/assign"), any(),
                eq(DrawAssignResult.class), any(ErrorCode.class)))
                .willReturn(new DrawAssignResult("0xrand", List.of(
                        new Assignment("101", "3"),
                        new Assignment("105", "1"),
                        new Assignment("230", "2"))));

        Ranking ranking = client.rank("resale:p7:d45:s1024:n1", 7L, List.of(101L, 105L, 230L));

        assertThat(ranking.randomness()).isEqualTo("0xrand");
        assertThat(ranking.orderedParticipantIds()).containsExactly(105L, 230L, 101L);
    }
}
