package com.teacat.server.sticker.entity;

/**
 * {@code sticker_jobs.fail_reason} 에 들어가는 값.
 *
 * <p>🔴 <b>enum 이 아니라 상수 클래스다.</b> 이 칸에는 워커가 보낸 문자열도 들어온다.
 * enum 으로 막으면 우리가 모르는 값이 왔을 때 역직렬화에서 터지고, 그건 남의 프로세스
 * 사정으로 우리 API 가 500 이 되는 것이다. 우리가 넣는 값만 여기 이름을 준다.
 */
public final class StickerFailReason {

    /** 컬럼이 VARCHAR(40) 이다. 넘치면 자른다 */
    public static final int MAX_LENGTH = 40;

    /** 워커가 직접 신고했다. 원문은 로그에만 남는다 */
    public static final String WORKER_ERROR = "WORKER_ERROR";

    /** 집어갔다 죽기를 반복해 재시도를 다 썼다 */
    public static final String RETRY_EXHAUSTED = "RETRY_EXHAUSTED";

    /** 아무도 집어가지 않았다. 워커가 안 떠 있다 */
    public static final String NO_WORKER = "NO_WORKER";

    private StickerFailReason() {
    }

    /** 컬럼 길이에 맞춰 자른다. 비어 있으면 {@link #WORKER_ERROR} */
    public static String truncate(String reason) {
        if (reason == null || reason.isBlank()) {
            return WORKER_ERROR;
        }

        String trimmed = reason.strip();
        return trimmed.length() <= MAX_LENGTH ? trimmed : trimmed.substring(0, MAX_LENGTH);
    }
}
