package com.teacat.server.banner.dto.response;

import com.teacat.server.banner.entity.MainBanner;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 홈에 뿌리는 배너.
 *
 * 링크는 <b>완성된 주소를 내려주지 않는다.</b> 공연 상세 경로 같은 건 프론트가 가진 규칙이라
 * 서버가 문자열로 박으면 프론트에서 경로를 바꿀 때 서버까지 고쳐야 한다.
 * 공연 배너는 performanceId 만 주고 화면이 자기 라우트로 조립한다.
 */
@Schema(description = "메인 배너")
public record BannerResponse(

        @Schema(description = "배너 ID", example = "1")
        Long bannerId,

        @Schema(description = "제목", example = "포토카드 마켓 오픈")
        String title,

        @Schema(description = "부제목")
        String subtitle,

        @Schema(description = "좌상단 라벨", example = "NEW")
        String label,

        @Schema(description = "배너 이미지 주소. 공연 배너면 그 공연의 포스터다. 없으면 null")
        String imageUrl,

        @Schema(description = "누르면 이동할 서비스 내 경로. 없으면 null", example = "/nft")
        String linkPath,

        @Schema(description = "연결된 공연 ID. 공연 배너가 아니면 null", example = "3")
        Long performanceId
) {

    public static BannerResponse of(MainBanner banner, String imageUrl) {
        return new BannerResponse(
                banner.getId(),
                banner.getTitle(),
                banner.getSubtitle(),
                banner.getLabel(),
                imageUrl,
                banner.getLinkPath(),
                banner.getPerformance() == null ? null : banner.getPerformance().getId()
        );
    }
}
