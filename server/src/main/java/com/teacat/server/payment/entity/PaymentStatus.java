package com.teacat.server.payment.entity;

/** DB 의 payment_status ENUM 과 1:1 */
public enum PaymentStatus {

    /** 주문번호와 금액을 확정했고 아직 결제창을 거치지 않았다 */
    READY,
    /**
     * 토스에 승인을 요청했고 아직 결과를 모른다.
     *
     * 승인 호출 <b>직전에</b> 이 상태로 선점하고 커밋한다. 그래야 중복 승인 요청을 막고,
     * 서버가 그 사이에 죽어도 복구 대상으로 남는다 (READY 로 두면 승인이 나갔는지 알 수 없다).
     */
    IN_PROGRESS,
    /** 승인 완료 */
    DONE,
    CANCELED,
    PARTIAL_CANCELED,
    /** 승인이 거절됐거나 실패했다 */
    ABORTED,
    EXPIRED;

    /** 아직 승인 결과가 확정되지 않았는가 (복구 배치의 대상인가) */
    public boolean isUnsettled() {
        return this == READY || this == IN_PROGRESS;
    }
}
