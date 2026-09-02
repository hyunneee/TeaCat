package com.teacat.server.user.entity;

/**
 * DB 의 user_role ENUM 과 1:1 로 대응한다. 순서/이름을 바꾸려면 마이그레이션이 함께 필요하다.
 */
public enum UserRole {
    ADMIN,
    USER,
    STADIUM,
    PERFORMANCE
}
