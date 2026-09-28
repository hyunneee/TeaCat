package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 꾸민 카드 저장 요청.
 *
 * <p>🔴 파일이 아니라 <b>캔버스가 만든 PNG 의 base64</b> 다 — AI 스티커의 낙서
 * ({@code sketchBase64})와 같은 방식이다. 합성은 클라이언트가 하고 서버는 올리기만 한다.
 *
 * <p>크기 상한은 서비스가 <b>디코드한 바이트 기준</b>으로 본다. base64 문자열 길이로 재면
 * 실제보다 1/3 크게 나오고, 무엇보다 막으려던 크기를 이미 힙에 올린 뒤가 된다.
 */
@Schema(description = "꾸민 카드 저장 요청")
public record NftDecorationSaveRequest(

        @Schema(description = "합성된 PNG 의 base64. data URL 접두어(`data:image/png;base64,`)는 빼고 보냅니다")
        @NotBlank(message = "이미지가 비어 있습니다.")
        String imageBase64,

        @Schema(description = "스티커 배치 정보(JSON 배열 문자열). 다시 꾸미기에 씁니다",
                example = "[{\"id\":\"a\",\"stickerId\":1,\"x\":0.5,\"y\":0.5,\"scale\":0.3,\"rotation\":0}]")
        @NotBlank(message = "배치 정보가 비어 있습니다.")
        @Size(max = 20_000, message = "배치 정보가 너무 깁니다.")
        String placements
) {
}
