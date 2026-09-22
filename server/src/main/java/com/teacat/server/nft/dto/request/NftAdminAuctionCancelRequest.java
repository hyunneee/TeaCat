package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 강제 취소 요청.
 *
 * <p>🔴 사유를 <b>반드시</b> 받는다. 남의 경매를 돌리고 담보를 푸는 동작이라, 이유 없이
 * 눌릴 수 있으면 안 된다 — 필수 입력 자체가 섣부른 취소를 한 번 멈춰 세우는 장치다.
 *
 * <p>⚠️ 사유는 <b>서버 로그에만</b> 남는다(사용자 결정). DB 열을 만들지 않았으므로
 * 어드민 화면에서 지나간 취소 이유를 되돌려 볼 수는 없다. 필요해지면 열을 추가해야 한다.
 */
@Schema(description = "경매 강제 취소 요청")
public record NftAdminAuctionCancelRequest(

        @Schema(description = "취소 사유. 서버 로그에 남습니다", example = "판매자 사칭 신고 접수")
        @NotBlank(message = "취소 사유를 입력해 주세요.")
        @Size(max = 200, message = "취소 사유는 200자 이내로 입력해 주세요.")
        String reason
) {
}
