package com.teacat.server.banner.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum BannerErrorCode implements ErrorCode {

    BANNER_NOT_FOUND(HttpStatus.NOT_FOUND, "BANNER_001", "존재하지 않는 배너입니다."),
    /** IMAGE 인데 이미지가 없다 */
    IMAGE_REQUIRED(HttpStatus.BAD_REQUEST, "BANNER_002", "배너 이미지를 올려 주세요."),
    /** PERFORMANCE 인데 공연을 안 골랐다 */
    PERFORMANCE_REQUIRED(HttpStatus.BAD_REQUEST, "BANNER_003", "연결할 공연을 선택해 주세요."),
    PERFORMANCE_NOT_FOUND(HttpStatus.NOT_FOUND, "BANNER_004", "존재하지 않는 공연입니다."),
    /** 올리지 않은 key 를 넘겼거나 업로드가 끝나기 전이다 */
    IMAGE_NOT_UPLOADED(HttpStatus.BAD_REQUEST, "BANNER_005", "이미지 업로드가 끝나지 않았습니다."),
    IMAGE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "BANNER_006", "이미지 용량이 너무 큽니다."),
    /** 순서 변경 요청에 지금 있는 배너가 다 들어있지 않다 */
    ORDER_MISMATCH(HttpStatus.BAD_REQUEST, "BANNER_007", "순서 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
