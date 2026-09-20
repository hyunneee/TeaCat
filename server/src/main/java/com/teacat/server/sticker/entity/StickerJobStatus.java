package com.teacat.server.sticker.entity;

/**
 * 스티커 생성 작업의 상태.
 *
 * <pre>
 *   PENDING ──(워커가 집어감)──▶ RUNNING ──(결과 도착)──▶ DONE
 *      ▲                           │
 *      └──(스위퍼: 5분 무응답)──────┘
 *                                  └──(워커 신고 · 재시도 소진)──▶ FAILED
 *   PENDING ──(스위퍼: 15분간 아무도 안 집어감)──▶ FAILED
 * </pre>
 *
 * <p>🔴 {@code FAILED} 는 <b>오늘 몫을 쓰지 않는다</b>. 워커 장애로 사용자 몫이 깎이면 안 된다.
 */
public enum StickerJobStatus {

    /** 만들어졌고 아무도 안 집어갔다 */
    PENDING,
    /** 워커가 집어가 그리는 중 */
    RUNNING,
    /** 스티커가 나왔다 */
    DONE,
    /** 못 만들었다. 오늘 몫에서 빠진다 */
    FAILED
}
