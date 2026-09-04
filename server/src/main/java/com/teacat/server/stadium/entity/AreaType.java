package com.teacat.server.stadium.entity;

/**
 * DB 의 area_type ENUM 과 1:1 로 대응한다.
 *
 * STANDING(스탠딩)은 좌석이 없다. 좌석 생성(API-269)에서 건너뛰어야 한다.
 */
public enum AreaType {
    SEATED,
    STANDING
}
