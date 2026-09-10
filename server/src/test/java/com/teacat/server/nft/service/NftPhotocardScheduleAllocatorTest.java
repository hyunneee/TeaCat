package com.teacat.server.nft.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 수량 중심 배정({@link NftPhotocardScheduleAllocator#allocate})의 순수 단위 테스트.
 *
 * <p>핵심 계약: 반환 배열의 합은 언제나 {@code recipientCount} 이하이고, 각 도안은 남은 재고를
 * 넘지 않는다. 재고가 남아돌면 앞 도안부터 채워지고 뒤 도안이 남는다.
 */
class NftPhotocardScheduleAllocatorTest {

    @Test
    void 재고가_넉넉하면_전원에게_배정되고_앞_도안부터_채운다() {
        int[] quantities = NftPhotocardScheduleAllocator.allocate(new int[] {5, 10}, 8);

        assertThat(quantities).containsExactly(5, 3);
        assertThat(sum(quantities)).isEqualTo(8);
    }

    @Test
    void 재고_합계가_수령자_수와_정확히_같으면_그대로_배정한다() {
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {3, 5}, 8))
                .containsExactly(3, 5);
    }

    @Test
    void 재고가_모자라면_재고만큼만_배정하고_나머지_수령자는_비운다() {
        int[] quantities = NftPhotocardScheduleAllocator.allocate(new int[] {2, 3}, 10);

        assertThat(quantities).containsExactly(2, 3);
        assertThat(sum(quantities)).isEqualTo(5); // 10명 중 5명만 받는다
    }

    @Test
    void 앞_도안이_수령자를_다_채우면_뒤_도안은_0이다() {
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {10, 10}, 4))
                .containsExactly(4, 0);
    }

    @Test
    void 도안이_하나뿐이어도_동작한다() {
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {100}, 7)).containsExactly(7);
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {3}, 7)).containsExactly(3);
    }

    @Test
    void 도안이_없거나_수령자가_없으면_빈_배정이다() {
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {}, 5)).isEmpty();
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {5, 5}, 0)).containsExactly(0, 0);
    }

    @Test
    void 음수_재고는_0으로_본다() {
        assertThat(NftPhotocardScheduleAllocator.allocate(new int[] {-5, 8}, 3))
                .containsExactly(0, 3);
    }

    private static int sum(int[] values) {
        int total = 0;
        for (int value : values) {
            total += value;
        }
        return total;
    }
}
