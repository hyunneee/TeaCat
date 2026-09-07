package com.teacat.server.nft.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * 경매 화면용 조회 (native SQL). 쓰기는 하지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class NftAuctionQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    /**
     * DB 의 현재 시각. 마감 시각을 이 값으로 계산해야 마감 판정(ends_at <= now())과 같은 시계를 쓴다.
     * ::timestamp 로 세션 타임존 기준 naive 값으로 받아 ends_at(timestamp) 과 같은 타입을 맞춘다.
     */
    public LocalDateTime currentTime() {
        return jdbcTemplate.queryForObject("SELECT now()::timestamp", new MapSqlParameterSource(), LocalDateTime.class);
    }
}
