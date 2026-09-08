package com.teacat.server.user.dto.response;

import com.teacat.server.user.entity.UserRole;

/**
 * 역할별 회원 수. JPQL 생성자 표현식으로 바로 채운다
 * ({@code UserRepository.countGroupByRole}).
 */
public record UserRoleCount(UserRole role, long count) {
}
