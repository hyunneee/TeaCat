package com.teacat.server.analytics.security;

import com.teacat.server.analytics.service.DailyActiveUserRecorder;
import com.teacat.server.auth.security.AuthUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 인증된 요청을 보고 그날의 접속으로 센다.
 *
 * <p>🔴 로그인 API 가 아니라 <b>모든 인증된 요청</b>에서 센다. 액세스 토큰이 1시간,
 * 리프레시가 14일이라 자동 로그인 사용자는 며칠씩 로그인 API 를 타지 않는다.
 * 로그인만 세면 매일 쓰는 사람일수록 안 세어진다.
 *
 * <p>{@code JwtAuthenticationFilter} 바로 뒤에 놓인다 — SecurityContext 가 채워진 다음이어야
 * 누구인지 알 수 있다. 인가(403)보다는 앞이라, 권한이 없어 거절된 요청도 "왔다" 로 센다.
 * 접속 여부를 보는 지표이므로 그게 맞다.
 *
 * <p>기록 자체는 {@link DailyActiveUserRecorder} 가 하고, 무슨 일이 있어도 예외를
 * 밖으로 내보내지 않는다.
 */
@RequiredArgsConstructor
public class DailyActiveUserFilter extends OncePerRequestFilter {

    private final DailyActiveUserRecorder recorder;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof AuthUser authUser) {
            recorder.record(authUser.id());
        }

        filterChain.doFilter(request, response);
    }
}
