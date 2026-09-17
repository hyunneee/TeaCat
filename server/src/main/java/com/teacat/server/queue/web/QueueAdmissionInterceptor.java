package com.teacat.server.queue.web;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.queue.exception.QueueErrorCode;
import com.teacat.server.queue.service.QueueAdmissionChecker;
import com.teacat.server.queue.service.QueueMetrics;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;

/**
 * 좌석·선점 API 앞의 문. 대기실이 켜진 회차면 입장 표식이 있는 요청만 통과시킨다.
 *
 * <p><b>필터가 아니라 인터셉터인 이유.</b> Security 필터 체인에서 던진 예외는 {@code GlobalExceptionHandler} 에
 * 닿지 않아 JSON 을 손으로 써야 한다. 인터셉터는 DispatcherServlet 안에서 돌아 {@link BusinessException} 을
 * 던지면 기존 핸들러가 {@code BaseResponse} 규격으로 428 을 내려준다. 이 시점엔 인증도 끝나 있다.
 *
 * <p><b>비로그인 요청.</b> 좌석맵 조회는 공개 GET 이라 인증 없이도 여기까지 온다. 대기실이 켜진 회차에서
 * 비로그인을 통과시키면 대기열을 우회하는 길이 되므로 같은 428 로 돌려보낸다. 프론트는 대기실로 보내고,
 * 대기실은 로그인을 요구한다. 대기실이 꺼진 회차(기본 상태)는 지금처럼 비로그인 조회가 된다.
 *
 * <p><b>Redis 장애.</b> 통과시킨다(fail-open). 막으면 좌석 조회 전체가 멈춰 서비스 중단이 된다.
 * 대기실이 잠깐 열리는 쪽이 낫다. 로그로 남겨 경보가 잡게 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QueueAdmissionInterceptor implements HandlerInterceptor {

    private final QueueAdmissionChecker checker;
    private final QueueMetrics metrics;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Long scheduleId = scheduleIdOf(request);
        if (scheduleId == null) {
            return true;
        }
        try {
            if (!checker.isEnabled(scheduleId)) {
                return true;
            }
            AuthUser authUser = currentUser();
            if (authUser == null || !checker.checkAndTouch(scheduleId, authUser.id())) {
                metrics.rejected(scheduleId);
                throw new BusinessException(QueueErrorCode.NOT_ADMITTED);
            }
            return true;
        } catch (DataAccessException e) {
            log.error("대기실 판정 중 Redis 오류 — 통과시킵니다(fail-open) scheduleId={}", scheduleId, e);
            return true;
        }
    }

    /** 좌석맵은 {scheduleId}, 선점은 {performanceDetailId}. 둘 다 회차 ID 다 */
    @SuppressWarnings("unchecked")
    private static Long scheduleIdOf(HttpServletRequest request) {
        Object attribute = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (!(attribute instanceof Map<?, ?> variables)) {
            return null;
        }
        Object raw = variables.get("scheduleId");
        if (raw == null) {
            raw = variables.get("performanceDetailId");
        }
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            return null;  // 컨트롤러의 타입 변환이 400 을 낸다. 여기서 막을 일이 아니다
        }
    }

    private static AuthUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthUser authUser) {
            return authUser;
        }
        return null;
    }
}
