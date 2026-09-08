package com.teacat.server.user.dto.response;

import com.teacat.server.user.entity.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 대시보드 요약 카드에 들어가는 숫자들.
 *
 * 탈퇴 회원은 전부 제외된 값이다 (User 의 @SQLRestriction).
 */
@Schema(description = "회원 요약 통계")
public record AdminUserStatsResponse(

        @Schema(description = "전체 회원 수", example = "137")
        long total,

        @Schema(description = "역할별 회원 수. 0 명인 역할도 키가 있다")
        Map<UserRole, Long> byRole,

        @Schema(description = "얼굴 정보를 등록한 회원 수", example = "88")
        long faceRegistered,

        @Schema(description = "최근 7일 신규 가입", example = "12")
        long joinedLast7Days
) {

    public static AdminUserStatsResponse of(List<UserRoleCount> roleCounts,
                                            long faceRegistered,
                                            long joinedLast7Days) {
        Map<UserRole, Long> counted = roleCounts.stream()
                .collect(Collectors.toMap(UserRoleCount::role, UserRoleCount::count));

        // 0 명인 역할도 키를 채운다. 프론트가 없는 키를 방어하지 않아도 되게.
        Map<UserRole, Long> byRole = new java.util.EnumMap<>(UserRole.class);
        for (UserRole role : UserRole.values()) {
            byRole.put(role, counted.getOrDefault(role, 0L));
        }

        long total = byRole.values().stream().mapToLong(Long::longValue).sum();

        return new AdminUserStatsResponse(total, byRole, faceRegistered, joinedLast7Days);
    }
}
