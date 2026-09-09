package com.teacat.server.banner.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 순서 변경 요청.
 *
 * 지금 있는 배너 <b>전부</b>를 원하는 순서대로 담아 보낸다.
 * 한 건씩 옮기면 중간에 다른 관리자가 끼어들었을 때 순서가 뒤엉킨다.
 */
@Schema(description = "배너 순서 변경 요청")
public record BannerOrderRequest(

        @Schema(description = "노출할 순서대로 나열한 배너 ID 전체", example = "[3, 1, 2]")
        @NotEmpty(message = "순서를 정할 배너가 없습니다.")
        List<Long> bannerIds
) {
}
