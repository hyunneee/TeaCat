package com.teacat.server.sticker.repository;

import com.teacat.server.sticker.entity.Sticker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StickerRepository extends JpaRepository<Sticker, Long> {

    /**
     * 내 스티커 목록. 지운 것은 빼고 최신순.
     *
     * <p>🔴 <b>소모한 것도 함께 나온다.</b> 목록에서는 "사용됨" 으로 보여 무엇을 만들었는지
     * 기록이 남는다. 꾸미기 서랍은 {@link #findUnused} 를 써서 안 쓴 것만 보여준다.
     */
    List<Sticker> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);

    /** 꾸미기 서랍용 — 아직 안 쓴 것만. {@code idx_stickers_unused} 를 탄다 */
    List<Sticker> findByUserIdAndUsedAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);

    /** 저장할 때 배치에 실린 스티커들을 한 번에 가져온다 (건마다 부르면 N+1) */
    List<Sticker> findByIdInAndDeletedAtIsNull(List<Long> ids);

    /** 이 카드에 이미 붙어 있는 것들 — 다시 저장해도 그대로 남아 있어야 한다 */
    List<Sticker> findByUsedPhotocardId(Long photocardId);

    /** 작업이 DONE 일 때 딸려 나가는 스티커. {@code uq_stickers_job} 이 하나를 보장한다 */
    Optional<Sticker> findByJobId(Long jobId);
}
