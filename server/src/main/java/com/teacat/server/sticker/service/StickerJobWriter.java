package com.teacat.server.sticker.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 작업 행을 넣는 한 트랜잭션.
 *
 * <p>🔴 <b>{@link StickerService} 와 다른 빈이어야 한다.</b> 같은 키로 동시에 두 번 들어오면
 * {@code uq_sticker_jobs_idempotency} 가 하나를 막는데, 그 예외를 <b>같은 트랜잭션 안에서</b>
 * 잡아 정상 응답을 만들면 커밋 때 {@code UnexpectedRollbackException} 이 난다 —
 * 예외가 난 순간 트랜잭션이 이미 rollback-only 로 표시되기 때문이다.
 *
 * <p>그래서 삽입만 이 빈의 트랜잭션에 가두고, 부르는 쪽은 트랜잭션 밖에서 예외를 받아
 * 새 트랜잭션으로 먼저 들어온 작업을 다시 찾는다.
 */
@Component
@RequiredArgsConstructor
class StickerJobWriter {

    private final StickerJobRepository jobRepository;
    private final UserRepository userRepository;

    @Transactional
    StickerJob insert(Long userId, String idempotencyKey, String sketchKey, String subject, int seed) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        // saveAndFlush — 유니크 충돌을 이 메서드 안에서 터뜨려야 부르는 쪽이 잡을 수 있다.
        // save 만 하면 커밋 시점에 터지고, 그때는 이미 이 트랜잭션 밖이다
        return jobRepository.saveAndFlush(
                StickerJob.pending(user, idempotencyKey, sketchKey, subject, seed));
    }
}
