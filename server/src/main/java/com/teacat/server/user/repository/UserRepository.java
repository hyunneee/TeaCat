package com.teacat.server.user.repository;

import com.teacat.server.user.dto.response.UserRoleCount;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    /* ── 관리자 회원 목록 ─────────────────────────────────────
       탈퇴 회원은 User 의 @SQLRestriction 이 알아서 걸러준다.

       🔴 역할 필터를 :role is null 로 한 쿼리에 합치지 않는다.
          users.role 이 PostgreSQL enum 타입이라 null 바인딩에서
          "could not determine data type of parameter" 가 난다.
          메서드를 둘로 나누고 서비스가 고른다.

       keyword 는 항상 값이 있다 (없으면 '%'). 소문자로 내려온다. */

    @Query("""
            select u from User u
            where lower(u.email) like :keyword
               or lower(u.name) like :keyword
               or lower(u.nickname) like :keyword
               or u.phone like :keyword
            """)
    Page<User> search(@Param("keyword") String keyword, Pageable pageable);

    @Query("""
            select u from User u
            where u.role = :role
              and (lower(u.email) like :keyword
                or lower(u.name) like :keyword
                or lower(u.nickname) like :keyword
                or u.phone like :keyword)
            """)
    Page<User> searchByRole(@Param("role") UserRole role,
                            @Param("keyword") String keyword,
                            Pageable pageable);

    /* ── 요약 통계 ───────────────────────────────────────────── */

    @Query("select new com.teacat.server.user.dto.response.UserRoleCount(u.role, count(u)) from User u group by u.role")
    List<UserRoleCount> countGroupByRole();

    long countByCreatedAtAfter(LocalDateTime since);

    @Query("select count(u) from User u where u.face is not null")
    long countFaceRegistered();

    long countByRole(UserRole role);
}
