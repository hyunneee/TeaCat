package com.teacat.server.common.ipfs;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum IpfsErrorCode implements ErrorCode {

    /** PINATA_JWT 가 없다. 도안 생성만 막히고 나머지 기능은 그대로 동작한다 */
    IPFS_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "IPFS_001",
            "IPFS 핀 서비스가 아직 준비되지 않았습니다."),
    /** 핀 자체가 실패했다. 그림이 어디에도 올라가지 않았으므로 도안을 만들면 안 된다 */
    PIN_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "IPFS_002",
            "이미지를 IPFS 에 올리지 못했습니다. 잠시 후 다시 시도해 주세요."),
    /** 200 은 받았는데 CID 가 안 왔다. 응답 모양이 바뀌었을 때 나는 에러다 */
    PIN_RESPONSE_INVALID(HttpStatus.SERVICE_UNAVAILABLE, "IPFS_003",
            "IPFS 응답에서 CID 를 찾지 못했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
