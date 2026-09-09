package com.teacat.server.inquiry.entity;

/**
 * DB 의 inquiry_status ENUM 과 1:1.
 *
 * OPEN 접수 → ANSWERED 답변 완료 → RESOLVED 해결.
 * 상태를 옮기는 것은 관리자뿐이고, 답변 없이 다음 단계로 갈 수 없다.
 */
public enum InquiryStatus {
    OPEN,
    ANSWERED,
    RESOLVED
}
