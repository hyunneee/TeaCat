package com.teacat.server.gate.entity;

/** DB 의 admission_method ENUM 과 1:1. 어떻게 통과시켰는가다 */
public enum AdmissionMethod {

    /** 얼굴 대조가 통과시켰다 (decision = MATCH) */
    FACE,

    /**
     * 운영자가 눌러서 통과시켰다.
     *
     * <p>판정이 REVIEW 로 떨어져 육안으로 확인했거나, 얼굴을 못 쓰는 상황(등록 안 된 회차,
     * 카메라 고장)에서 수동 검표한 경우다. {@code admitted_by} 가 누가 책임졌는지 남긴다.
     */
    MANUAL
}
