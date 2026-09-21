package com.teacat.server.common.storage;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum StorageErrorCode implements ErrorCode {

    EMPTY_FILE(HttpStatus.BAD_REQUEST, "STORAGE_001", "업로드할 파일이 없습니다."),
    UNSUPPORTED_IMAGE_TYPE(HttpStatus.BAD_REQUEST, "STORAGE_002", "지원하지 않는 이미지 형식입니다. (jpg, png, webp, gif)"),
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "STORAGE_003", "파일 용량이 너무 큽니다."),
    UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_004", "파일 업로드에 실패했습니다."),
    URL_ISSUE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_005", "파일 주소 발급에 실패했습니다."),
    DELETE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_006", "파일 삭제에 실패했습니다."),
    DOWNLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_007", "파일을 읽지 못했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
