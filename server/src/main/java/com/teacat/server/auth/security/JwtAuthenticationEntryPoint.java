package com.teacat.server.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.common.exception.ErrorCode;
import com.teacat.server.common.response.BaseResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 인증 실패 응답도 {@link BaseResponse} 형식을 그대로 따른다.
 * (Security 필터에서 터지는 예외는 GlobalExceptionHandler 까지 오지 않는다)
 */
@RequiredArgsConstructor
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        ErrorCode errorCode = (ErrorCode) request.getAttribute(JwtAuthenticationFilter.ERROR_CODE_ATTRIBUTE);

        if (errorCode == null) {
            errorCode = AuthErrorCode.UNAUTHORIZED;
        }

        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), BaseResponse.fail(errorCode));
    }
}
