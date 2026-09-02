package com.teacat.server.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.teacat.server.common.exception.ErrorCode;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Getter
@Schema(description = "공통 응답 형식")
@JsonInclude(JsonInclude.Include.NON_NULL) // 필드 값이 null이면 그 필드 자체를 응답 JSON에서 제외
public class BaseResponse<T> {

    @Schema(description = "요청 성공 여부", example = "true")
    private final boolean success;

    @Schema(description = "에러 코드 (성공 시 응답에서 생략됨)", example = "AUTH_001")
    private final String code;

    @Schema(description = "응답 메시지 (없으면 응답에서 생략됨)", example = "요청이 성공적으로 처리되었습니다.")
    private final String message;

    @Schema(description = "응답 데이터 (없으면 응답에서 생략됨)")
    private final T data;

    private BaseResponse(boolean success, String code, String message, T data) {
        this.success = success;
        this.code = code;
        this.message = message;
        this.data = data;
    }

    // 성공 - 데이터만
    public static <T> BaseResponse<T> success(T data) {
        return new BaseResponse<>(true, null, null, data);
    }

    // 성공 - 메시지만
    public static <T> BaseResponse<T> success(String message) {
        return new BaseResponse<>(true, null, message, null);
    }

    // 성공 - 메시지 + 데이터
    public static <T> BaseResponse<T> success(String message, T data) {
        return new BaseResponse<>(true, null, message, data);
    }

    // 실패
    public static <T> BaseResponse<T> fail(ErrorCode errorCode) {
        return new BaseResponse<>(false, errorCode.getCode(), errorCode.getMessage(), null);
    }

    // 실패 - 메시지만
    public static <T> BaseResponse<T> fail(String message) {
        return new BaseResponse<>(false, null, message, null);
    }
}
