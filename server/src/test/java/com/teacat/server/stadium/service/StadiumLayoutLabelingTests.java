package com.teacat.server.stadium.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.stadium.dto.request.SeatLabelingRuleRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StadiumLayoutLabelingTests {

    @Test
    void 알파벳_시작_행을_구역별로_지정할_수_있다() {
        SeatLabelingRuleRequest rule = new SeatLabelingRuleRequest(
                "TOP_TO_BOTTOM", "ALPHA", "C", "LEFT_TO_RIGHT", 1);

        assertThat(StadiumLayoutService.rowLabel(rule, false, 0)).isEqualTo("C");
        assertThat(StadiumLayoutService.rowLabel(rule, false, 1)).isEqualTo("D");
    }

    @Test
    void 두_글자_알파벳과_가나다_시작_행을_지원한다() {
        SeatLabelingRuleRequest alphaRule = new SeatLabelingRuleRequest(
                "TOP_TO_BOTTOM", "ALPHA", "AA", "LEFT_TO_RIGHT", 1);
        SeatLabelingRuleRequest hangulRule = new SeatLabelingRuleRequest(
                "TOP_TO_BOTTOM", "HANGUL", "다", "LEFT_TO_RIGHT", 1);

        assertThat(StadiumLayoutService.rowLabel(alphaRule, false, 0)).isEqualTo("AA");
        assertThat(StadiumLayoutService.rowLabel(hangulRule, true, 0)).isEqualTo("다");
        assertThat(StadiumLayoutService.rowLabel(hangulRule, true, 1)).isEqualTo("라");
    }

    @Test
    void 잘못된_시작_행은_거절한다() {
        SeatLabelingRuleRequest rule = new SeatLabelingRuleRequest(
                "TOP_TO_BOTTOM", "ALPHA", "3A", "LEFT_TO_RIGHT", 1);

        assertThatThrownBy(() -> StadiumLayoutService.rowLabel(rule, false, 0))
                .isInstanceOf(BusinessException.class);
    }
}
