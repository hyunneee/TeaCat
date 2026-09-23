package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.TradeSimulationRequest;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 🔴 안전장치를 고정한다. 시뮬레이터가 만든 거래는 COMPLETED 로 들어가 시세 중앙값·거래량·인기
 * 포토카드 순위에 그대로 섞인다. 운영에서 한 번 돌면 실거래와 합성이 뒤엉켜
 * "실데이터 기준 정밀도" 를 말할 수 없게 된다 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>그래서 {@code nft.trade.simulator.enabled} 는 <b>기본값이 false</b> 여야 한다.
 * 이 테스트는 설정을 일부러 덮지 않는다 — application.yaml 의 기본값 그대로를 본다.
 */
class NftTradeRiskSimulatorDisabledTests extends PostgresIntegrationTest {

    @Autowired private NftTradeRiskSimulator simulator;

    @Test
    void 설정을_켜지_않으면_거절한다() {
        assertThatThrownBy(() -> simulator.simulate(new TradeSimulationRequest(1, 1, 1, 0, 0, 0, 0, 1L)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(NftErrorCode.SIMULATOR_DISABLED);
    }

    @Test
    void 거절되면_아무것도_만들지_않는다() {
        Integer before = jdbcTemplate.queryForObject("SELECT count(*) FROM simulation_labels", Integer.class);

        assertThatThrownBy(() -> simulator.simulate(new TradeSimulationRequest(1, 1, 1, 0, 0, 0, 0, 1L)))
                .isInstanceOf(BusinessException.class);

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM simulation_labels", Integer.class))
                .isEqualTo(before);
    }
}
