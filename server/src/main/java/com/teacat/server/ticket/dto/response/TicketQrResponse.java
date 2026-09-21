package com.teacat.server.ticket.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 티켓 QR 에 그릴 문자열.
 *
 * <p>🔴 <b>QR 이미지를 서버가 만들지 않는다.</b> 문자열만 내려주고 그림은 화면이 그린다 —
 * 이미지를 만들어 내려보내면 서버에 QR 인코딩 의존성이 생기고, 화면 크기·색·다크모드에
 * 맞추려면 매번 서버를 다시 불러야 한다.
 */
@Schema(description = "티켓 QR")
public record TicketQrResponse(

        @Schema(description = "QR 에 담을 서명된 문자열", example = "T1.1.Zm9vYmFyYmF6")
        String token
) {
}
