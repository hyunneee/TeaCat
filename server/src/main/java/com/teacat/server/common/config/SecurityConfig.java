package com.teacat.server.common.config;

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
            "/areas/**"
    };

    private static final long CORS_PREFLIGHT_MAX_AGE_SECONDS = 3600L;

    private final JwtTokenProvider jwtTokenProvider;
    private final CorsProperties corsProperties;
    private final ObjectMapper objectMapper;

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
                        // 공연 조회는 비로그인도 볼 수 있어야 한다 (API-201, API-202)
                        .requestMatchers(HttpMethod.GET, PUBLIC_GET_ENDPOINTS).permitAll()
                        .requestMatchers(HttpMethod.GET, "/nft-market/photocards", "/photocards/**").permitAll()
                        // 좁은 규칙이 먼저다. 아래 /admin/** 이 위에 오면 이 줄에는 도달하지 못한다
                        .requestMatchers("/admin/performances/*/photocards/issue").hasRole(UserRole.ADMIN.name())
                        .requestMatchers("/admin/stadiums", "/admin/stadiums/**",
                                "/admin/areas/**", "/admin/seats/**")
                        .hasAnyRole(UserRole.ADMIN.name(), UserRole.STADIUM.name())
                        // 매처를 빠뜨린 관리자 API 도 잠기도록 마지막에 포괄 규칙을 둔다
                        .requestMatchers("/admin/**").hasRole(UserRole.ADMIN.name())
                        .anyRequest().authenticated())
                .exceptionHandling(handler -> handler
                        .authenticationEntryPoint(new JwtAuthenticationEntryPoint(objectMapper))
                        .accessDeniedHandler(new JwtAccessDeniedHandler(objectMapper)))
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class)
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
