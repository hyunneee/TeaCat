package com.teacat.server.resale.entity;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SeatDrawTests {

    @Test
    void 추첨_키에_공연_회차_좌석_회차번호가_들어간다() {
        SeatDraw draw = SeatDraw.open(7L, 45L, 12L, 1024L, List.of(101L, 105L, 230L), 9L);

        assertThat(draw.getDrawKey()).isEqualTo("resale:p7:d45:s1024:n1");
        assertThat(draw.getStatus()).isEqualTo(SeatDrawStatus.PENDING);
        assertThat(draw.participantIdList()).containsExactly(101L, 105L, 230L);
        assertThat(draw.getDrawNo()).isEqualTo(1);
    }

    @Test
    void 다시_열면_같은_좌석에_회차번호가_하나_오른다() {
        SeatDraw first = SeatDraw.open(7L, 45L, 12L, 1024L, List.of(101L), 9L);

        SeatDraw next = first.reopen(List.of(101L, 300L));

        assertThat(next.getDrawKey()).isEqualTo("resale:p7:d45:s1024:n2");
        assertThat(next.getDrawNo()).isEqualTo(2);
        assertThat(next.participantIdList()).containsExactly(101L, 300L);
        assertThat(next.getSourceTicketOrderId()).isEqualTo(9L);
    }

    @Test
    void 난수와_순위를_저장하고_순위를_하나씩_넘긴다() {
        SeatDraw draw = SeatDraw.open(7L, 45L, 12L, 1024L, List.of(101L, 105L, 230L), 9L);
        draw.markOpened("0xtx", "0xinputs");

        draw.markRevealed("0xrand", List.of(230L, 101L, 105L));

        assertThat(draw.isRevealed()).isTrue();
        assertThat(draw.rankingList()).containsExactly(230L, 101L, 105L);
        assertThat(draw.getNextRank()).isZero();

        draw.skipRank();
        draw.grant(101L, 1);

        assertThat(draw.getCurrentEntryId()).isEqualTo(101L);
        assertThat(draw.getNextRank()).isEqualTo(2);
    }

    @Test
    void 당첨자가_떠나면_접고_다음_회차가_이어받는다() {
        SeatDraw draw = SeatDraw.open(7L, 45L, 12L, 1024L, List.of(101L, 105L), 9L);
        draw.markOpened("0xtx", "0xinputs");
        draw.markRevealed("0xrand", List.of(105L, 101L));
        draw.grant(105L, 0);

        draw.markRedrawn("당첨 포기");
        SeatDraw next = draw.reopen(List.of(101L, 300L));

        assertThat(draw.getStatus()).isEqualTo(SeatDrawStatus.REDRAWN);
        assertThat(draw.getStatus().isActive()).isFalse();
        assertThat(draw.getFailureReason()).isEqualTo("당첨 포기");
        assertThat(next.getDrawKey()).isEqualTo("resale:p7:d45:s1024:n2");
        assertThat(next.getStatus()).isEqualTo(SeatDrawStatus.PENDING);
        assertThat(next.getCurrentEntryId()).isNull();
    }

    @Test
    void 실패_사유는_컬럼_길이에_맞춰_잘린다() {
        SeatDraw draw = SeatDraw.open(7L, 45L, 12L, 1024L, List.of(101L), 9L);

        draw.markFailed("x".repeat(500));

        assertThat(draw.getStatus()).isEqualTo(SeatDrawStatus.FAILED);
        assertThat(draw.getFailureReason()).hasSize(200);
        assertThat(draw.getStatus().isActive()).isFalse();
    }
}
