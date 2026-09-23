package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardDecoration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 포카 꾸밈 조회.
 *
 * <p>🔴 <b>카드 하나에 꾸밈 하나다</b> ({@code uq_photocard_decorations_card}).
 * 꾸밈은 <b>카드의 일부</b>라 카드가 팔리면 함께 넘어간다 — 그래서 사람으로 거르지 않는다.
 *
 * <p>⚠️ 2026-09-22 에는 {@code findByPhotocardIdAndUserId} 였다. 그때는 꾸밈이 <b>만든 사람의
 * 것</b>이어서 새 주인에게 안 보이게 사람으로 걸렀다. 2026-09-23 에 "마켓에도 꾸민 모습을
 * 보여주고 사는 사람이 그대로 받는다" 로 바뀌며 뒤집혔다 — 보이는 것과 받는 것이 달라
 * 사는 사람이 속는 문제를 없애기 위해서다.
 */
public interface NftPhotocardDecorationRepository extends JpaRepository<NftPhotocardDecoration, Long> {

    Optional<NftPhotocardDecoration> findByPhotocardId(Long photocardId);

    /** 목록 화면용 — 카드마다 따로 부르면 N+1 이다 */
    List<NftPhotocardDecoration> findByPhotocardIdIn(List<Long> photocardIds);
}
