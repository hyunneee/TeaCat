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
    TICKETING_ALREADY_STARTED(HttpStatus.CONFLICT, "PERFORMANCE_003",
            "티켓팅이 시작된 공연은 공연장·티켓팅 시각·노출 시작일을 변경할 수 없습니다."),
    INVALID_VISIBLE_FROM(HttpStatus.BAD_REQUEST, "PERFORMANCE_004",
            "노출 시작일은 티켓팅 시작 시각보다 앞서야 합니다."),
    NOTHING_TO_UPDATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_005", "변경할 내용이 없습니다."),
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_006", "존재하지 않는 회차입니다."),
    DUPLICATE_SCHEDULE_NUM(HttpStatus.CONFLICT, "PERFORMANCE_007", "이미 등록된 회차 번호입니다."),
    INVALID_PERFORMANCE_DATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_008",
            "공연 일자는 티켓팅 시작일 이후여야 합니다."),
    SCHEDULE_HAS_TICKETS(HttpStatus.CONFLICT, "PERFORMANCE_009",
            "예매 이력이 있는 회차는 삭제할 수 없습니다."),
    AREA_NOT_IN_STADIUM(HttpStatus.BAD_REQUEST, "PERFORMANCE_010",
            "공연장에 속하지 않은 구역입니다."),
    DUPLICATE_AREA(HttpStatus.BAD_REQUEST, "PERFORMANCE_011", "같은 구역이 중복으로 들어왔습니다."),
    AREA_MAX_CNT_BELOW_SOLD(HttpStatus.CONFLICT, "PERFORMANCE_012",
            "이미 판매된 수량보다 적게 최대 판매수량을 줄일 수 없습니다."),
    AREA_NOT_CONFIGURED(HttpStatus.CONFLICT, "PERFORMANCE_013",
            "공연 구역 등급·가격을 먼저 설정해 주세요."),
    SEATS_ALREADY_GENERATED(HttpStatus.CONFLICT, "PERFORMANCE_014",
            "이미 좌석이 생성된 회차입니다."),
    NO_SEATS_TO_GENERATE(HttpStatus.CONFLICT, "PERFORMANCE_015",
            "생성할 좌석이 없습니다. 공연장 배치도에 좌석이 등록되어 있는지 확인해 주세요."),
    IMAGE_NOT_UPLOADED(HttpStatus.BAD_REQUEST, "PERFORMANCE_016",
            "업로드되지 않은 이미지입니다. 발급받은 URL 로 파일을 먼저 올려 주세요."),
    PERFORMANCE_HAS_TICKETS(HttpStatus.CONFLICT, "PERFORMANCE_017",
            "예매 이력이 있는 공연은 삭제할 수 없습니다. 비공개로 전환해 주세요."),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, "PERFORMANCE_018",
            "허용되지 않는 상태 전환입니다. UPCOMING → ONGOING → ENDED 순서로만 바꿀 수 있고, "
                    + "종료·취소된 공연은 되돌릴 수 없습니다."),
    IMAGE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "PERFORMANCE_019",
            "업로드한 이미지가 용량 한도를 넘어 삭제했습니다. 업로드 URL 발급 응답의 maxFileSizeBytes 이하로 줄여서 다시 올려 주세요."),
    NOT_OWNER(HttpStatus.FORBIDDEN, "PERFORMANCE_020",
            "본인이 등록한 공연만 관리할 수 있습니다."),
    DUPLICATE_PERFORMANCE_DATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_021",
            "같은 일시의 회차가 두 번 들어왔습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
