package com.teacat.server.sticker.repository;

import java.util.Optional;

/**
 * 워커가 일감을 집어가는 한 문장.
 *
 * <p>Spring Data 의 파생 쿼리로는 표현할 수 없어 따로 뺐다 — {@code @Modifying} 은 갱신 건수만
 * 돌려주는데, 우리는 <b>어떤 행을 집었는지</b>를 같은 문장에서 알아야 한다.
 */
public interface StickerJobClaimRepository {

    /**
     * 가장 오래 기다린 PENDING 작업 하나를 RUNNING 으로 바꾸고 그 id 를 돌려준다. 없으면 비어 있다.
     *
     * <p>🔴 <b>고르기와 표시가 한 문장이어야 한다.</b> {@code SELECT} 후 {@code UPDATE} 로
     * 나누면 그 사이가 경쟁 구간이고, 워커가 둘이면 같은 낙서를 두 번 그린다. GPU 시간이
     * 두 배로 나가고 둘 중 하나는 {@code uq_stickers_job} 에 막혀 버려진다.
     *
     * <p>{@code FOR UPDATE SKIP LOCKED} 라 두 번째 워커는 잠긴 행을 기다리지 않고 다음 것을 집는다.
     */
    Optional<Long> claimNext(String workerId);
}
