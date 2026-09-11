package com.teacat.server.auth.security;

import com.teacat.server.user.entity.UserRole;

/**
 * 인증된 요청의 주체. 컨트롤러에서 {@code @AuthenticationPrincipal AuthUser} 로 받는다.
 */
public record AuthUser(Long id, UserRole role) {

    /**
     * 전체 관리자인가.
     *
     * 남이 등록한 자료도 다룰 수 있다. 도메인별 관리자(STADIUM·PERFORMANCE)는 자기가 등록한
     * 것만 다루므로, 소유자 검사를 건너뛸지 정할 때 이 값을 본다.
     */
    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }
}
