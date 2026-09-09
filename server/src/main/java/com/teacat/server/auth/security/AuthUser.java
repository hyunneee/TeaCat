package com.teacat.server.auth.security;

import com.teacat.server.user.entity.UserRole;

/**
 * 인증된 요청의 주체. 컨트롤러에서 {@code @AuthenticationPrincipal AuthUser} 로 받는다.
 */
public record AuthUser(Long id, UserRole role) {

    /**
     * 최고 권한인가.
     *
     * <p>경로 단위 접근 제어는 {@code SecurityConfig} 가 한다. 이 메서드는 <b>같은 API 안에서
     * 관리자만 예외를 두는</b> 경우에 쓴다 — 예를 들어 공연 관리는 등록자 본인만 할 수 있지만
     * 관리자는 남이 등록한 공연도 손댈 수 있어야 한다(운영자가 못 고치는 데이터가 남으면 안 된다).
     */
    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }
}
