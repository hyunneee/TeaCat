package com.teacat.server.analytics.repository;

import java.time.LocalDate;

/**
 * "그 날짜에 몇 건" 한 줄. 일자별 집계 네이티브 쿼리가 공통으로 쓴다.
 *
 * <p>값이 0 인 날은 행이 아예 없다. 빈 날짜를 채우는 것은 서비스가 한다
 * (SQL 로 generate_series 를 쓰는 것보다 읽기 쉽고, 세 쿼리가 같은 방식으로 채워진다).
 *
 * <p>네이티브 쿼리의 별칭이 {@code bucket} · {@code total} 이어야 매핑된다.
 */
public interface DailyCountProjection {

    LocalDate getBucket();

    long getTotal();
}
