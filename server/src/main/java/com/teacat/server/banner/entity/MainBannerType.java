package com.teacat.server.banner.entity;

/** DB 의 main_banner_type ENUM 과 1:1 */
public enum MainBannerType {
    /** 직접 올린 이미지 + 상대 경로 링크 */
    IMAGE,
    /** 공연 지정 — 이미지는 공연 포스터, 링크는 공연 상세 */
    PERFORMANCE
}
