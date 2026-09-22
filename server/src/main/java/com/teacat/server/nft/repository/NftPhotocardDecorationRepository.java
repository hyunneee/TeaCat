package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardDecoration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 포카 꾸밈 조회.
 *
 * <p>🔴 <b>카드만으로 찾는 메서드를 만들지 마라.</b> 주인이 바뀐 뒤 그렇게 읽으면 새 주인
 * 화면에 예전 주인의 그림이 뜬다. 여기 있는 메서드가 전부 {@code userId} 를 함께 받는 것은
 * 실수로 그렇게 쓰지 못하게 하려는 것이다.
 */
public interface NftPhotocardDecorationRepository extends JpaRepository<NftPhotocardDecoration, Long> {

    Optional<NftPhotocardDecoration> findByPhotocardIdAndUserId(Long photocardId, Long userId);

    /** 목록 화면용 — 카드마다 따로 부르면 N+1 이다 */
    List<NftPhotocardDecoration> findByUserIdAndPhotocardIdIn(Long userId, List<Long> photocardIds);
}
