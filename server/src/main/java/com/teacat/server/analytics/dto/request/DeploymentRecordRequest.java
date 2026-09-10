package com.teacat.server.analytics.dto.request;

import com.teacat.server.analytics.entity.Deployment;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 젠킨스가 배포 성공 직후 보내는 것.
 *
 * <p>🔴 배포 시각은 받지 않는다. 서버가 받은 시각으로 찍는다 — 젠킨스 컨테이너와 서버의
 * 시간대가 다르면(젠킨스 기본은 UTC, 우리 DB 는 Asia/Seoul) 마커가 9 시간 밀려 찍히고,
 * 그런 차트는 틀린 줄도 모른 채 읽게 된다. 젠킨스는 배포 직후에 보내므로 차이는 몇 초다.
 */
@Schema(description = "배포 기록 요청 (내부용)")
public record DeploymentRecordRequest(

        @Schema(description = "배포 환경", example = "prod", allowableValues = {"prod", "dev"})
        @NotBlank
        @Pattern(regexp = "prod|dev", message = "환경은 prod 또는 dev 여야 합니다.")
        String environment,

        @Schema(description = "브랜치", example = "master")
        @NotBlank
        @Size(max = Deployment.BRANCH_MAX_LENGTH)
        String branch,

        @Schema(description = "커밋 해시 (짧은 형식이어도 됩니다)", example = "af27fca")
        @NotBlank
        @Size(max = Deployment.COMMIT_HASH_MAX_LENGTH)
        @Pattern(regexp = "[0-9a-f]{7,40}", message = "커밋 해시 형식이 아닙니다.")
        String commitHash,

        @Schema(description = "커밋 제목 한 줄. 길면 잘라서 보내세요", example = "feat: 메인 배너 CRUD")
        @Size(max = Deployment.SUMMARY_MAX_LENGTH)
        String summary,

        @Schema(description = "젠킨스 빌드 번호", example = "42")
        @Positive
        Integer buildNumber
) {
}
