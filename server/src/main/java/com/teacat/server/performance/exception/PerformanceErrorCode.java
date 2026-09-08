package com.teacat.server.performance.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PerformanceErrorCode implements ErrorCode {
    PERFORMANCE_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_001", "존재하지 않는 공연입니다."),
    STADIUM_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_002", "존재하지 않는 공연장입니다."),
    TICKETING_ALREADY_STARTED(HttpStatus.CONFLICT, "PERFORMANCE_003", "예매가 시작된 공연의 주요 정보는 변경할 수 없습니다."),
    INVALID_VISIBLE_FROM(HttpStatus.BAD_REQUEST, "PERFORMANCE_004", "노출 시작일은 예매 시작일보다 늦을 수 없습니다."),
    NOTHING_TO_UPDATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_005", "변경할 내용이 없습니다."),
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_006", "존재하지 않는 회차입니다."),
    DUPLICATE_SCHEDULE_NUM(HttpStatus.CONFLICT, "PERFORMANCE_007", "이미 등록된 회차 번호입니다."),
    INVALID_PERFORMANCE_DATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_008", "공연 일시는 예매 시작 이후여야 합니다."),
    SCHEDULE_HAS_TICKETS(HttpStatus.CONFLICT, "PERFORMANCE_009", "예매 이력이 있는 회차는 삭제할 수 없습니다."),
    AREA_NOT_IN_STADIUM(HttpStatus.BAD_REQUEST, "PERFORMANCE_010", "공연의 좌석 배치에 속하지 않는 구역입니다."),
    DUPLICATE_AREA(HttpStatus.BAD_REQUEST, "PERFORMANCE_011", "같은 구역이 중복으로 포함되었습니다."),
    AREA_MAX_CNT_BELOW_SOLD(HttpStatus.CONFLICT, "PERFORMANCE_012", "이미 판매된 수량보다 최대 판매 수량을 낮출 수 없습니다."),
    AREA_NOT_CONFIGURED(HttpStatus.CONFLICT, "PERFORMANCE_013", "공연 구역의 등급과 가격을 먼저 설정해 주세요."),
    SEATS_ALREADY_GENERATED(HttpStatus.CONFLICT, "PERFORMANCE_014", "이미 좌석이 생성된 회차입니다."),
    NO_SEATS_TO_GENERATE(HttpStatus.CONFLICT, "PERFORMANCE_015", "생성할 좌석이 없습니다. 공연 배치에 좌석이 등록되어 있는지 확인해 주세요."),
    IMAGE_NOT_UPLOADED(HttpStatus.BAD_REQUEST, "PERFORMANCE_016", "업로드되지 않은 이미지입니다. 발급받은 URL로 파일을 먼저 올려 주세요."),
    PERFORMANCE_HAS_TICKETS(HttpStatus.CONFLICT, "PERFORMANCE_017", "예매 이력이 있는 공연은 삭제할 수 없습니다. 비공개로 전환해 주세요."),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, "PERFORMANCE_018", "허용되지 않는 상태 전환입니다."),
    IMAGE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "PERFORMANCE_019", "업로드한 이미지가 용량 제한을 초과했습니다."),
    NOT_OWNER(HttpStatus.FORBIDDEN, "PERFORMANCE_020", "본인이 등록한 공연만 관리할 수 있습니다."),
    DUPLICATE_PERFORMANCE_DATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_021", "같은 일시의 회차가 두 번 포함되었습니다."),
    STADIUM_LAYOUT_NOT_FOUND(HttpStatus.CONFLICT, "PERFORMANCE_LAYOUT_001", "공연장에 활성 기본 배치가 없습니다."),
    PERFORMANCE_LAYOUT_MISMATCH(HttpStatus.BAD_REQUEST, "PERFORMANCE_LAYOUT_002", "공연장과 선택한 배치가 일치하지 않습니다."),
    PERFORMANCE_LAYOUT_LOCKED(HttpStatus.CONFLICT, "PERFORMANCE_LAYOUT_003", "예매 시작 이후에는 공연 배치를 변경할 수 없습니다."),
    BLOCKED_SEAT_CONFLICT(HttpStatus.CONFLICT, "PERFORMANCE_LAYOUT_004", "점유 또는 판매된 좌석은 차단할 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
