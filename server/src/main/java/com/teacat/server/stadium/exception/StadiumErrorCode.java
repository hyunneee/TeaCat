package com.teacat.server.stadium.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum StadiumErrorCode implements ErrorCode {
    STADIUM_NOT_FOUND(HttpStatus.NOT_FOUND, "STADIUM_001", "존재하지 않는 공연장입니다."),
    AREA_NOT_FOUND(HttpStatus.NOT_FOUND, "STADIUM_002", "존재하지 않는 구역입니다."),
    SEAT_NOT_FOUND(HttpStatus.NOT_FOUND, "STADIUM_003", "존재하지 않는 좌석입니다."),
    NOTHING_TO_UPDATE(HttpStatus.BAD_REQUEST, "STADIUM_004", "변경할 내용이 없습니다."),
    DUPLICATE_AREA_CODE(HttpStatus.CONFLICT, "STADIUM_005", "같은 배치에 동일한 구역 코드가 이미 존재합니다."),
    DUPLICATE_SEAT(HttpStatus.CONFLICT, "STADIUM_006", "같은 구역에 동일한 열과 번호의 좌석이 이미 존재합니다."),
    MAX_SEAT_EXCEEDED(HttpStatus.BAD_REQUEST, "STADIUM_007", "구역의 최대 좌석 수를 초과할 수 없습니다."),
    STANDING_AREA_HAS_SEATS(HttpStatus.BAD_REQUEST, "STADIUM_008", "스탠딩 구역에는 개별 좌석을 생성할 수 없습니다."),
    STADIUM_IN_USE(HttpStatus.CONFLICT, "STADIUM_009", "공연 또는 예매에서 사용 중인 공연장은 삭제할 수 없습니다."),
    AREA_IN_USE(HttpStatus.CONFLICT, "STADIUM_010", "공연 또는 예매에서 사용 중인 구역은 삭제할 수 없습니다."),
    SEAT_IN_USE(HttpStatus.CONFLICT, "STADIUM_011", "공연 또는 예매에서 사용 중인 좌석은 삭제할 수 없습니다."),
    AREA_STRUCTURE_LOCKED(HttpStatus.CONFLICT, "STADIUM_012", "좌석 또는 사용 이력이 있는 구역의 구조를 변경할 수 없습니다."),
    SEAT_UPDATE_LOCKED(HttpStatus.CONFLICT, "STADIUM_013", "공연 또는 예매에서 사용 중인 좌석은 수정할 수 없습니다."),
    MAX_SEAT_BELOW_CURRENT(HttpStatus.CONFLICT, "STADIUM_014", "최대 좌석 수를 현재 좌석 수보다 작게 설정할 수 없습니다."),
    INVALID_LAYOUT_IMAGE(HttpStatus.BAD_REQUEST, "STADIUM_015", "좌석표 이미지는 정상적인 JPG 또는 PNG 파일이어야 합니다."),
    LAYOUT_IMAGE_SIZE_CONFLICT(HttpStatus.CONFLICT, "STADIUM_016", "배치 좌표가 존재해 크기가 다른 이미지로 교체할 수 없습니다."),
    INVALID_LAYOUT_POSITION(HttpStatus.BAD_REQUEST, "STADIUM_017", "배치 좌표가 불완전하거나 허용 범위를 벗어났습니다."),
    LAYOUT_NOT_FOUND(HttpStatus.NOT_FOUND, "LAYOUT_001", "공연장 배치를 찾을 수 없습니다."),
    LAYOUT_IN_USE(HttpStatus.CONFLICT, "LAYOUT_002", "공연에서 사용 중인 배치는 삭제하거나 구조를 변경할 수 없습니다."),
    DEFAULT_LAYOUT_REQUIRED(HttpStatus.CONFLICT, "LAYOUT_003", "기본 배치는 다른 기본 배치를 지정하기 전에 삭제할 수 없습니다."),
    INVALID_LAYOUT(HttpStatus.BAD_REQUEST, "LAYOUT_004", "배치 크기 또는 요소 좌표가 올바르지 않습니다."),
    DUPLICATE_LAYOUT_NAME(HttpStatus.CONFLICT, "LAYOUT_005", "같은 공연장에 동일한 배치 이름이 존재합니다."),
    INVALID_EXCEL(HttpStatus.BAD_REQUEST, "EXCEL_001", "지원하는 .xlsx 파일이 아닙니다."),
    ENCRYPTED_EXCEL(HttpStatus.BAD_REQUEST, "EXCEL_002", "암호화되거나 매크로가 포함된 Excel 파일은 사용할 수 없습니다."),
    EXCEL_LIMIT_EXCEEDED(HttpStatus.PAYLOAD_TOO_LARGE, "EXCEL_003", "Excel 파일 크기 또는 분석 한도를 초과했습니다."),
    EXCEL_ANALYSIS_NOT_FOUND(HttpStatus.NOT_FOUND, "EXCEL_004", "Excel 분석 결과가 없거나 유효 시간이 만료되었습니다."),
    INVALID_EXCEL_MAPPING(HttpStatus.BAD_REQUEST, "EXCEL_005", "선택한 후보, 라벨 또는 구역 매핑이 올바르지 않습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
