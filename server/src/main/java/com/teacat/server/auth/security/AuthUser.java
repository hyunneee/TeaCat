package com.teacat.server.auth.security;

import com.teacat.server.user.entity.UserRole;

/**
 * 인증된 요청의 주체. 컨트롤러에서 {@code @AuthenticationPrincipal AuthUser} 로 받는다.
 */
public record AuthUser(Long id, UserRole role) {
}
