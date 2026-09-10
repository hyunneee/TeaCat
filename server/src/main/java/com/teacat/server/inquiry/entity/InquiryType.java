package com.teacat.server.inquiry.entity;

/** DB 의 inquiry_type ENUM 과 1:1. 값을 늘리려면 마이그레이션이 함께 필요하다 */
public enum InquiryType {
    /** 오류 신고 */
    BUG,
    /** 개선 제안 */
    IMPROVEMENT,
    /** 기타 */
    ETC
}
