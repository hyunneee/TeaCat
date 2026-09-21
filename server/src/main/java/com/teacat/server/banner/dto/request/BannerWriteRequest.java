package com.teacat.server.banner.dto.request;

import com.teacat.server.banner.entity.MainBanner;
import com.teacat.server.banner.entity.MainBannerImageFocus;
import com.teacat.server.banner.entity.MainBannerType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 배너 등록·수정 요청.
 *
 * 타입에 따라 채워야 할 칸이 다르다. 어떤 칸이 필요한지는 서비스가 확인한다
 * (Bean Validation 만으로는 "타입이 IMAGE 일 때만 필수" 를 표현할 수 없다).
 */
@Schema(description = "배너 등록·수정 요청")
public record BannerWriteRequest(

        @Schema(description = "IMAGE: 이미지 직접 등록 / PERFORMANCE: 공연 지정", example = "IMAGE")
        @NotNull(message = "배너 유형을 선택해 주세요.")
        MainBannerType type,

        @Schema(description = "제목", example = "포토카드 마켓 오픈")
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = MainBanner.TITLE_MAX_LENGTH, message = "제목은 60자를 넘을 수 없습니다.")
        String title,

        @Schema(description = "부제목", example = "모은 캣머니로 원하는 포카를 교환하세요")
        @Size(max = MainBanner.SUBTITLE_MAX_LENGTH, message = "부제목은 100자를 넘을 수 없습니다.")
        String subtitle,

        @Schema(description = "좌상단 라벨", example = "NEW")
        @Size(max = MainBanner.LABEL_MAX_LENGTH, message = "라벨은 20자를 넘을 수 없습니다.")
        String label,

        @Schema(description = "업로드한 이미지 key (IMAGE 일 때 필수)",
                example = "banner/2026/09/a1b2c3.png")
        String imageKey,

        @Schema(description = """
                그림에서 보여줄 한 점의 가로 위치(%). 배너 틀(폰 4:3 · 데스크톱 2:1)과 비율이
                다르면 나머지가 잘린다. 0 이 왼쪽 끝, 50 이 가운데, 100 이 오른쪽 끝이고
                CSS `object-position` 으로 그대로 옮겨진다. 타입과 무관하며, 비우면 50 이다.
                """, example = "50")
        @Min(value = 0, message = "보여줄 위치는 0 ~ 100 사이여야 합니다.")
        @Max(value = 100, message = "보여줄 위치는 0 ~ 100 사이여야 합니다.")
        Integer imageFocusX,

        @Schema(description = """
                그림에서 보여줄 한 점의 세로 위치(%). 0 이 위쪽 끝, 50 이 가운데,
                100 이 아래쪽 끝이다. 비우면 50 이다.
                """, example = "30")
        @Min(value = 0, message = "보여줄 위치는 0 ~ 100 사이여야 합니다.")
        @Max(value = 100, message = "보여줄 위치는 0 ~ 100 사이여야 합니다.")
        Integer imageFocusY,

        @Schema(description = "연결할 공연 ID (PERFORMANCE 일 때 필수)", example = "3")
        Long performanceId,

        @Schema(description = """
                누르면 이동할 우리 서비스 안의 경로 (IMAGE 일 때만, 비우면 이동 없음).
                외부 주소는 넣을 수 없습니다.
                """, example = "/nft")
        @Pattern(regexp = "^/(?!/).*$", message = "'/' 로 시작하는 서비스 내 경로만 넣을 수 있습니다.")
        @Size(max = 255, message = "경로가 너무 깁니다.")
        String linkPath,

        @Schema(description = "노출 여부", example = "true")
        @NotNull(message = "노출 여부를 선택해 주세요.")
        Boolean active
) {

    /**
     * 크롭 위치는 <b>필수로 받지 않는다.</b> 이 칸을 모르는 예전 화면이 보낸 요청에서
     * 400 이 나면 배너를 아예 못 고치게 된다. 안 오면 지금까지와 같은 가운데다.
     */
    public MainBannerImageFocus imageFocusOrCenter() {
        return MainBannerImageFocus.of(imageFocusX, imageFocusY);
    }
}
