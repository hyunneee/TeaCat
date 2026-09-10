package com.teacat.server.nft.service;

/**
 * 회차 자동 발급의 <b>수량 중심 배정</b>.
 *
 * <p>스케줄러에는 사람이 넣어 주는 도안별 수량이 없다. 그래서 도안을 순서대로 훑으며
 * <b>남은 재고만큼</b> 채우되, 발급 수량 합계가 회차 수령자 수를 넘지 않게만 한다.
 *
 * <ul>
 *   <li>재고 합 ≥ 수령자 수 → 전원이 카드를 받는다 (앞 도안부터 채워지고 뒤 도안이 남는다)
 *   <li>재고 합 &lt; 수령자 수 → 재고만큼만 나가고 일부 수령자는 카드가 없다 (허용된 동작)
 * </ul>
 *
 * <p>순수 함수라 별도 단위 테스트로 검증한다({@code NftPhotocardScheduleAllocatorTest}).
 * 도안의 "순서" 는 부르는 쪽이 정한다 — {@code NftService} 는 도안 id 오름차순을 넘긴다.
 */
final class NftPhotocardScheduleAllocator {

    private NftPhotocardScheduleAllocator() {
    }

    /**
     * @param remainingByDesign 도안별 남은 재고({@code total_supply - issued_supply}). 음수는 0 으로 본다
     * @param recipientCount    이번 회차에서 카드를 받을 수 있는 수령자 수
     * @return 도안별 발급 수량. 길이는 입력과 같고, <b>총합은 {@code recipientCount} 이하</b>다
     */
    static int[] allocate(int[] remainingByDesign, int recipientCount) {
        int[] quantities = new int[remainingByDesign.length];
        int allocated = 0;
        for (int i = 0; i < remainingByDesign.length && allocated < recipientCount; i++) {
            int available = Math.max(remainingByDesign[i], 0);
            int quantity = Math.min(available, recipientCount - allocated);
            quantities[i] = quantity;
            allocated += quantity;
        }
        return quantities;
    }
}
