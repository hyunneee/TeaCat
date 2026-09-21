package com.teacat.server.queue.web;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 대기실 인터셉터가 지키는 경로 (server/QUEUE_DESIGN.md 8장).
 *
 * <p>경로는 서블릿 컨텍스트({@code /api}) 안 기준이다.
 * <ul>
 *   <li>{@code /schedules/{sid}/seats} — 좌석맵 폴링. 부하의 본체</li>
 *   <li>{@code /performance-details/{sid}/seats/{seatId}/hold} — 선점·해제. 대기열을 건너뛰고 좌석을 잡는 우회 차단</li>
 * </ul>
 *
 * <p>걸지 <b>않는</b> 곳: {@code /schedules/{sid}}, {@code /schedules/{sid}/booking-status}, {@code /concerts/**}.
 * 회차 정보와 오픈 카운트다운은 대기실 화면에서도 보여야 한다.
 * 결제 경로({@code /payments/**})는 요청 바디의 scheduleId 를 봐야 해서 2차 작업이다.
 */
@Configuration
@RequiredArgsConstructor
public class QueueWebConfig implements WebMvcConfigurer {

    private final QueueAdmissionInterceptor interceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor)
                .addPathPatterns(
                        "/schedules/*/seats",
                        "/performance-details/*/seats/*/hold");
    }
}
