package com.teacat.server.analytics.dto.response;

import com.teacat.server.analytics.entity.Deployment;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 차트에 얹는 배포 마커 한 개.
 *
 * <p>🔴 이건 상관관계지 인과가 아니다. 마커 다음 날 가입이 늘었다고 그 배포가 늘린 것은
 * 아니다. 무엇을 언제 내보냈는지를 겹쳐 보는 용도다.
 */
@Schema(description = "배포 마커")
public record DeploymentMarkerResponse(

        @Schema(description = "배포 ID", example = "3")
        Long deploymentId,

        @Schema(description = "배포 시각", example = "2026-09-09T14:02:11")
        LocalDateTime deployedAt,

        @Schema(description = "브랜치", example = "master")
        String branch,

        @Schema(description = "커밋 해시 (짧은 형식)", example = "af27fca")
        String commitHash,

        @Schema(description = "커밋 제목. 젠킨스가 못 읽었으면 null", example = "feat: 메인 배너 CRUD")
        String summary,

        @Schema(description = "젠킨스 빌드 번호", example = "42")
        Integer buildNumber
) {

    public static DeploymentMarkerResponse from(Deployment deployment) {
        return new DeploymentMarkerResponse(
                deployment.getId(),
                deployment.getDeployedAt(),
                deployment.getBranch(),
                deployment.getCommitHash(),
                deployment.getSummary(),
                deployment.getBuildNumber());
    }
}
