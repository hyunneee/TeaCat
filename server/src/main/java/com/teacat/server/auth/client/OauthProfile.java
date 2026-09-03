package com.teacat.server.auth.client;

/**
 * 제공자에게서 받아온 사용자 정보 중 우리가 쓰는 것만 추린 값.
 *
 * @param providerUserId 제공자가 주는 고유 식별자 (연결의 기준)
 * @param email          제공자 계정 이메일
 * @param name           실명. 없으면 null 일 수 있다
 */
public record OauthProfile(String providerUserId, String email, String name) {
}
