package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Schema(description = "카드팩 이벤트 등록 요청")
public record NftPhotocardPackEventCreateRequest(

        @Schema(description = "이벤트 코드. 지급된 팩의 source_ref 가 되며 계정당 1회의 기준이다. "
                + "등록 뒤에는 바꿀 수 없다", example = "SUMMER_2026")
        @NotBlank(message = "이벤트 코드를 입력해 주세요.")
        @Size(max = 50, message = "이벤트 코드는 50자 이하여야 합니다.")
        @Pattern(regexp = "^[A-Z0-9_]+$", message = "이벤트 코드는 영문 대문자·숫자·밑줄만 쓸 수 있습니다.")
        String code,

        @Schema(description = "어드민 목록에 보일 이름", example = "여름 맞이 카드팩")
        @NotBlank(message = "이벤트 이름을 입력해 주세요.")
        @Size(max = 100, message = "이벤트 이름은 100자 이하여야 합니다.")
        String name,

        @Schema(description = "시작 시각. 비우면 즉시 시작")
        LocalDateTime startsAt,

        @Schema(description = "종료 시각. 비우면 무기한")
        LocalDateTime endsAt
) {

    /**
     * 기간이 뒤집히지 않았는가.
     *
     * <p>뒤집어 넣으면 진행 중 판정({@code starts_at <= now() AND ends_at > now()})이 영원히
     * 거짓이라 <b>아무 소리 없이 지급되지 않는 이벤트</b>가 만들어진다. code 는 나중에 고칠 수
     * 없으므로 새로 등록해야 한다 — 들어오기 전에 막는다.
     *
     * <p>한쪽만 비어 있는 것은 정상이다(즉시 시작 · 무기한).
     */
    @AssertTrue(message = "종료 시각은 시작 시각보다 뒤여야 합니다.")
    @Schema(hidden = true)
    public boolean isPeriodValid() {
        return startsAt == null || endsAt == null || endsAt.isAfter(startsAt);
    }
}
