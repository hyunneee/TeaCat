package com.teacat.server.banner.dto.response;

import com.teacat.server.banner.entity.MainBanner;
import com.teacat.server.banner.entity.MainBannerImageFocus;
import com.teacat.server.banner.entity.MainBannerType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 관리 화면용. 홈 응답에 없는 운영 정보(순서·노출·원본 key)를 함께 준다 */
@Schema(description = "배너 (관리자)")
public record AdminBannerResponse(

        @Schema(description = "배너 ID", example = "1")
        Long bannerId,

        @Schema(description = "유형", example = "IMAGE")
        MainBannerType type,

        @Schema(description = "제목")
        String title,

        @Schema(description = "부제목")
        String subtitle,

        @Schema(description = "좌상단 라벨")
        String label,

        @Schema(description = "미리보기용 이미지 주소. 공연 배너면 포스터다")
        String imageUrl,

        @Schema(description = "업로드한 이미지 key. 공연 배너면 null")
        String imageKey,

        @Schema(description = "그림에서 보여줄 부분", example = "CENTER")
        MainBannerImageFocus imageFocus,

        @Schema(description = "연결된 공연 ID. 이미지 배너면 null", example = "3")
        Long performanceId,

        @Schema(description = "연결된 공연 제목. 이미지 배너면 null")
        String performanceTitle,

        @Schema(description = "누르면 이동할 경로. 없으면 null", example = "/nft")
        String linkPath,

        @Schema(description = "노출 순서 (작을수록 앞)", example = "0")
        Integer sortOrder,

        @Schema(description = "노출 여부", example = "true")
        boolean active,

        @Schema(description = "등록 일시")
        LocalDateTime createdAt
) {

    public static AdminBannerResponse of(MainBanner banner, String imageUrl) {
        return new AdminBannerResponse(
                banner.getId(),
                banner.getType(),
                banner.getTitle(),
                banner.getSubtitle(),
                banner.getLabel(),
                imageUrl,
                banner.getImageKey(),
                banner.getImageFocus(),
                banner.getPerformance() == null ? null : banner.getPerformance().getId(),
                banner.getPerformance() == null ? null : banner.getPerformance().getTitle(),
                banner.getLinkPath(),
                banner.getSortOrder(),
                banner.isActive(),
                banner.getCreatedAt()
        );
    }
}
