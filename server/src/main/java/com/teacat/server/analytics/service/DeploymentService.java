package com.teacat.server.analytics.service;

import com.teacat.server.analytics.dto.request.DeploymentRecordRequest;
import com.teacat.server.analytics.exception.AnalyticsErrorCode;
import com.teacat.server.analytics.repository.DeploymentRepository;
import com.teacat.server.common.config.AnalyticsProperties;
import com.teacat.server.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;

/**
 * 배포 기록 (젠킨스 → 서버).
 *
 * <p>사람이 부르는 API 가 아니라 파이프라인이 부른다. 로그인 세션이 없으므로
 * 미리 나눠 가진 키 하나로 인증한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeploymentService {

    private final DeploymentRepository deploymentRepository;
    private final AnalyticsProperties analyticsProperties;

    /**
     * 배포 하나를 기록한다. 같은 환경의 같은 커밋이면 무시한다 (멱등).
     *
     * @param presentedKey 요청 헤더로 들어온 내부 키
     */
    public void record(String presentedKey, DeploymentRecordRequest request) {
        verifyKey(presentedKey);

        // 시각은 서버가 찍는다 — 젠킨스와 시간대가 다르면 마커가 통째로 밀린다
        int inserted = deploymentRepository.record(
                request.environment(),
                request.branch(),
                request.commitHash(),
                request.summary(),
                request.buildNumber(),
                LocalDateTime.now());

        if (inserted == 0) {
            log.info("이미 기록된 배포입니다. environment={}, commit={}",
                    request.environment(), request.commitHash());
        }
    }

    /**
     * 내부 키 검증.
     *
     * <p>🔴 설정에 키가 없으면 전부 거절한다. 키가 비었을 때 통과시키면, 운영 서버에
     * 환경변수를 안 넣은 실수가 "아무나 쓸 수 있는 엔드포인트" 로 조용히 바뀐다.
     *
     * <p>비교는 {@link MessageDigest#isEqual}. {@code equals} 는 앞에서부터 다른 곳이 나오면
     * 바로 멈춰서, 응답 시간 차이로 키를 한 글자씩 알아낼 수 있다.
     */
    private void verifyKey(String presentedKey) {
        String expected = analyticsProperties.internalApiKey();

        if (!StringUtils.hasText(expected) || !StringUtils.hasText(presentedKey)) {
            throw new BusinessException(AnalyticsErrorCode.INVALID_INTERNAL_KEY);
        }

        boolean matches = MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                presentedKey.getBytes(StandardCharsets.UTF_8));

        if (!matches) {
            throw new BusinessException(AnalyticsErrorCode.INVALID_INTERNAL_KEY);
        }
    }
}
