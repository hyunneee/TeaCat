package com.teacat.server.nft.entity;

/** DB 의 nft_review_analysis_status ENUM 과 1:1. AI 분석 보고서의 상태 */
public enum NftReviewAnalysisStatus {
    /** 아직 분석 안 붙음. 분석 스위퍼가 집는다 */
    PENDING,
    DONE,
    /** 재시도 한도를 넘김. 규칙 결과만으로 심사한다 */
    FAILED,
    /** 분석이 꺼져 있거나(API 키 없음) 모델이 거부함. 재시도하지 않는다 */
    SKIPPED
}
