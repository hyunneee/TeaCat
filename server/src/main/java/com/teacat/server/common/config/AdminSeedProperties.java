package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 admin.seed.* 설정.
 *
 * 서버가 뜰 때 관리자 계정이 하나도 없으면 이 값으로 만들어 둔다.
 * 없으면 대시보드에 처음 들어갈 방법이 없다 — 역할을 올려줄 관리자가 필요하고,
 * 그 관리자를 만들 수 있는 건 관리자뿐이라 닫힌 고리가 된다.
 *
 * 🔴 운영에서는 반드시 password 를 환경변수로 덮어쓰거나 enabled=false 로 끄세요.
 *    기본 비밀번호는 저장소에 적혀 있어 누구나 압니다.
 *
 * @param enabled  false 면 아무것도 하지 않는다
 * @param email    로그인 아이디
 * @param password 평문. 저장 시 BCrypt 로 해싱된다
 */
@ConfigurationProperties(prefix = "admin.seed")
public record AdminSeedProperties(
        boolean enabled,
        String email,
        String password,
        String name,
        String nickname,
        String phone
) {
}
