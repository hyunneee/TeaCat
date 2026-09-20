package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 예매자 명단의 입장 상태 필터.
 *
 * <p>{@code Boolean} 을 그대로 받지 않는 이유: 셋째 값이 "전체" 다. {@code null} 을 전체로
 * 쓰면 파라미터를 빠뜨린 것과 전체를 고른 것이 구분되지 않아, 화면과 서버가 서로 다른
 * 기본값을 갖게 된다.
 */
@Schema(description = "입장 상태 필터 - ALL 전체 · CHECKED_IN 입장 완료 · NOT_CHECKED_IN 미입장")
public enum OperationsCheckInFilter {
    ALL,
    CHECKED_IN,
    NOT_CHECKED_IN;

    /** 조회 조건으로 쓰는 값. 전체면 null (조건을 걸지 않는다) */
    public Boolean toCheckedIn() {
        return switch (this) {
            case ALL -> null;
            case CHECKED_IN -> Boolean.TRUE;
            case NOT_CHECKED_IN -> Boolean.FALSE;
        };
    }
}
