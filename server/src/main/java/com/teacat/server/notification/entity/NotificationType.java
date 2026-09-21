package com.teacat.server.notification.entity;

/** 알림 종류. DB 에는 문자열로 저장된다 — 값을 늘릴 때 마이그레이션이 필요 없다 */
public enum NotificationType {
    /** 취소표 추첨 당첨. 결제 기한 안에 예매해야 한다 */
    RESALE_WON,
    /** 당첨했지만 기한 안에 결제하지 않아 다음 사람에게 넘어갔다 */
    RESALE_EXPIRED
}
