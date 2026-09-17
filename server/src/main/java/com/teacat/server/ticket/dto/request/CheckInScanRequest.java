package com.teacat.server.ticket.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 게이트에서 티켓을 확인한다 (얼굴 대조 전 단계).
 *
 * <p>QR 을 찍었으면 {@code qrToken} 을, 카메라가 없거나 QR 이 안 읽혀 번호를 손으로 넣었으면
 * {@code ticketId} 를 보낸다. <b>둘 중 하나만</b> 보낸다.
 *
 * <p>🔴 번호 직접 입력을 열어 두는 것이 QR 서명을 무의미하게 만들지 않는다 — 이 API 는
 * <b>ADMIN 전용</b>이고, 관리자는 어차피 회원 상세에서 티켓을 볼 수 있다. 서명이 막는 것은
 * 줄 서 있는 사람이 만들어 온 가짜 QR 이다.
 */
@Schema(description = "입장 확인 - 티켓 조회 요청")
public record CheckInScanRequest(

        @Schema(description = "QR 에서 읽은 문자열. 번호를 직접 넣었다면 생략합니다.")
        String qrToken,

        @Schema(description = "티켓 번호. QR 을 찍었다면 생략합니다.", example = "1")
        @Positive(message = "티켓 번호가 올바르지 않습니다.")
        Long ticketId,

        @Schema(description = "지금 검표 중인 회차 ID", example = "1")
        @NotNull(message = "회차를 선택해 주세요.")
        @Positive(message = "회차가 올바르지 않습니다.")
        Long performanceDetailId
) {
}
