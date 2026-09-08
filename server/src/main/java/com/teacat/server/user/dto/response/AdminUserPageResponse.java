package com.teacat.server.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 관리자 회원 목록 (페이지 번호 방식).
 *
 * 공연 목록은 커서 페이징이지만 여기는 페이지 번호다.
 * 관리 화면의 표는 "3페이지로 바로 가기" 와 전체 건수가 필요하고,
 * 무한 스크롤이 아니라 정렬·필터를 자주 바꿔 가며 보기 때문이다.
 */
@Schema(description = "관리자용 회원 목록")
public record AdminUserPageResponse(

        @Schema(description = "회원 목록")
        List<AdminUserResponse> users,

        @Schema(description = "현재 페이지 (0부터)", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "20")
        int size,

        @Schema(description = "조건에 맞는 전체 건수", example = "137")
        long totalElements,

        @Schema(description = "전체 페이지 수", example = "7")
        int totalPages
) {

    public static AdminUserPageResponse from(Page<?> page, List<AdminUserResponse> users) {
        return new AdminUserPageResponse(
                users,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
