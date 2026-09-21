package com.teacat.server.sticker.repository;

import com.teacat.server.sticker.entity.Sticker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StickerRepository extends JpaRepository<Sticker, Long> {

    /** 내 스티커 목록. 지운 것은 빼고 최신순 */
    List<Sticker> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);

    /** 작업이 DONE 일 때 딸려 나가는 스티커. {@code uq_stickers_job} 이 하나를 보장한다 */
    Optional<Sticker> findByJobId(Long jobId);
}
