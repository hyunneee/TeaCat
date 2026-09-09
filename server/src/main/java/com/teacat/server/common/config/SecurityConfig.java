package com.teacat.server.common.config;

import com.teacat.server.analytics.security.DailyActiveUserFilter;
import com.teacat.server.analytics.service.DailyActiveUserRecorder;
import com.teacat.server.auth.security.JwtAccessDeniedHandler;
import com.teacat.server.auth.security.JwtAuthenticationEntryPoint;
import com.teacat.server.auth.security.JwtAuthenticationFilter;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.user.entity.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    /** 인증 없이 열어두는 경로 */
    private static final String[] PUBLIC_ENDPOINTS = {
            "/auth/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**"
    };

    /** GET 만 인증 없이 열어두는 경로 */
    private static final String[] PUBLIC_GET_ENDPOINTS = {
            "/concerts",
            "/concerts/**",
            "/schedules/**",
            "/stadiums",
            "/stadiums/**",
            "/stadium-layouts/**",
            "/areas/**",
            "/performances/**",
            // 홈 상단 슬라이드. 비로그인도 첫 화면을 봐야 한다
            "/banners"
    };

    private static final long CORS_PREFLIGHT_MAX_AGE_SECONDS = 3600L;

    private final JwtTokenProvider jwtTokenProvider;
    private final CorsProperties corsProperties;
    private final ObjectMapper objectMapper;
    private final DailyActiveUserRecorder dailyActiveUserRecorder;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                // 세션을 쓰지 않고 토큰으로만 인증하므로 CSRF 토큰이 필요 없다
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        // 배포 파이프라인(젠킨스)이 부르는 경로. 로그인 세션이 없어서 토큰으로
                        // 인증할 수 없고, 대신 컨트롤러가 X-Internal-Api-Key 를 검사한다.
                        //
                        // 🔴 여기에 경로를 늘릴 때는 그 컨트롤러가 키를 검사하는지 반드시 확인할 것.
                        //    검사를 빠뜨리면 인터넷에 그대로 열린 API 가 된다.
                        .requestMatchers("/internal/**").permitAll()
                        // 공연 조회는 비로그인도 볼 수 있어야 한다 (API-201, API-202)
                        .requestMatchers(HttpMethod.GET, PUBLIC_GET_ENDPOINTS).permitAll()
                        // NFT 마켓·경매 조회는 비로그인도 볼 수 있다. GET 만 열리므로 입찰·즉시구매·취소는 그대로 인증이 필요하다
                        .requestMatchers(HttpMethod.GET, "/nft-market/photocards", "/photocards/**",
                                "/nft-market/auctions", "/auctions/**").permitAll()
                        // 좁은 규칙이 먼저다. 아래 /admin/** 이 위에 오면 이 줄에는 도달하지 못한다
                        .requestMatchers("/admin/performances/*/photocards/issue").hasRole(UserRole.ADMIN.name())
                        // 전체 공연 목록은 운영자만 본다. 공연 주최자에게는 /admin/concerts/mine 이 있다.
                        //
                        // 🔴 아래 /admin/concerts/** 보다 먼저 와야 한다 — /** 는 빈 경로도 삼켜서
                        //    순서를 바꾸면 PERFORMANCE 도 남의 공연 목록을 보게 된다.
                        .requestMatchers(HttpMethod.GET, "/admin/concerts").hasRole(UserRole.ADMIN.name())
                        // 공연 관리(등록·수정·회차·구역·이미지)는 공연 주최자(PERFORMANCE)도 쓴다.
                        // 등록자 본인 것만 다룰 수 있는 건 서비스가 따로 검사한다(PERFORMANCE_020).
                        // ADMIN 은 그 검사에서 예외라 남이 등록한 공연도 다룰 수 있다.
                        .requestMatchers("/admin/concerts/**", "/admin/schedules/**", "/admin/uploads/**")
                        .hasAnyRole(UserRole.ADMIN.name(), UserRole.PERFORMANCE.name())
                        // 공연장·구역·좌석 배치 관리는 공연장 운영자(STADIUM)도 쓴다
                        .requestMatchers("/admin/stadiums", "/admin/stadiums/**",
                                "/admin/stadium-layouts/**", "/admin/areas/**", "/admin/seats/**")
                        .hasAnyRole(UserRole.ADMIN.name(), UserRole.STADIUM.name())
                        // 나머지 /admin/** (포토카드 발급·회원 관리 등)은 그대로 ADMIN 전용이다
                        // 매처를 빠뜨린 관리자 API 도 잠기도록 마지막에 포괄 규칙을 둔다
                        .requestMatchers("/admin/**").hasRole(UserRole.ADMIN.name())
                        .anyRequest().authenticated())
                .exceptionHandling(handler -> handler
                        .authenticationEntryPoint(new JwtAuthenticationEntryPoint(objectMapper))
                        .accessDeniedHandler(new JwtAccessDeniedHandler(objectMapper)))
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class)
                // 인증이 끝난 뒤여야 누가 왔는지 알 수 있다. 하루 접속자 집계용이고,
                // 실패해도 요청에 영향을 주지 않는다 (DailyActiveUserRecorder)
                .addFilterAfter(new DailyActiveUserFilter(dailyActiveUserRecorder),
                        JwtAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        // 리프레시 토큰 쿠키를 주고받기 위해 필요하다. 이 값이 true 면 origin 에 * 를 쓸 수 없다
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(CORS_PREFLIGHT_MAX_AGE_SECONDS);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
