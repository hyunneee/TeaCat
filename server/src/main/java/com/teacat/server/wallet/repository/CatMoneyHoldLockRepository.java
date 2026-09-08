package com.teacat.server.wallet.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 한 유저의 홀드 생성을 직렬화한다.
 *
 * "가용 잔액 조회 → 홀드 INSERT" 사이에 같은 유저의 다른 요청이 끼면 둘 다 잔액이 충분하다고 보고
 * 합계가 잔액을 넘을 수 있다. 트랜잭션 범위 advisory lock 으로 유저 단위로 줄을 세운다.
 *
 * 번호대 {@code 739002…} 는 기존 구매 직렬화({@code NftMarketQueryRepository.lockPurchaseBuyer}, {@code 739001…})와
 * 다르게 둔다. 같은 번호를 쓰면 고정가 구매와 입찰이 의도치 않게 서로 대기한다.
 */
@Repository
@RequiredArgsConstructor
public class CatMoneyHoldLockRepository {

    private static final long LOCK_NAMESPACE = 739002000000000000L;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void lockUser(Long userId) {
        jdbcTemplate.query("SELECT pg_advisory_xact_lock(:key)",
                new MapSqlParameterSource("key", LOCK_NAMESPACE + userId), rs -> {
                    // 잠금 함수의 반환값은 void 라 읽지 않는다
                });
    }
}
