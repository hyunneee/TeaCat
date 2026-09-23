package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import com.teacat.server.wallet.service.CatMoneyService;

import java.math.BigInteger;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.request.StickerCreateRequest;
import com.teacat.server.sticker.dto.response.StickerCreateResponse;
import com.teacat.server.sticker.dto.response.StickerJobResponse;
import com.teacat.server.sticker.dto.response.StickerQuotaResponse;
import com.teacat.server.sticker.dto.response.StickerResponse;
import com.teacat.server.sticker.entity.Sticker;
import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.exception.StickerErrorCode;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.sticker.repository.StickerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 사용자가 부르는 스티커 API.
 *
 * <p>서버는 그림을 만들지 않는다. 낙서를 받아 일감으로 세워 두면 워커(GPU)가 집어간다.
 */
@Service
@RequiredArgsConstructor
public class StickerService {

    /**
     * 🔴 하루 경계는 KST 다. DB 컨테이너는 UTC, 앱 컨테이너는 {@code TZ=Asia/Seoul} 이라
     * SQL 안에서 {@code now()::date} 로 자르면 <b>매일 09시 이전 요청이 어제 몫으로</b> 세어진다.
     * 새벽에는 쓰는 사람이 없어 운영에서 한참을 못 찾는 종류의 어긋남이다.
     */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private static final String SKETCH_DIRECTORY = "sticker/sketch";

    private final StickerJobRepository jobRepository;
    private final StickerRepository stickerRepository;
    private final StickerJobWriter jobWriter;
    private final FileStorageService fileStorageService;
    private final StickerImageCodec codec;
    private final StickerImageResolver imageResolver;
    private final StickerProperties properties;
    private final CatMoneyService catMoneyService;
    private final CatMoneyHoldService holdService;

    /**
     * 낙서를 받아 일감을 세운다.
     *
     * <p>🔴 <b>트랜잭션을 걸지 않는다.</b> 멱등키 충돌을 잡아 정상 응답으로 바꾸려면 예외가
     * 트랜잭션 밖에서 잡혀야 한다 ({@link StickerJobWriter} 주석 참고). 한 번에 여러 행을
     * 바꾸지 않아 원자성이 필요하지도 않다.
     *
     * <p>⚠️ 그래서 <b>오늘 몫 검사와 삽입 사이가 열려 있다</b> — 같은 사람이 동시에 두 번
     * 보내면 상한을 1장 넘길 수 있다. 막으려면 사용자 행을 잠가야 하는데, 한 명이 1장 더
     * 만드는 것보다 잠금이 비싸다. 알고 두는 것이다.
     */
    public StickerCreateResponse create(Long userId, StickerCreateRequest request, String idempotencyKeyHeader) {
        String idempotencyKey = parseIdempotencyKey(idempotencyKeyHeader);

        // 같은 키면 여기서 끝난다. MinIO 업로드도, 몫 차감도 하지 않는다
        Optional<StickerJob> existing = jobRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (existing.isPresent()) {
            return new StickerCreateResponse(existing.get().getId(), remainingToday(userId));
        }

        /* 하루 무료 몫을 넘기면 거절이 아니라 **유료**다 (2026-09-23).
           🔴 태우는 것을 낙서 업로드보다 **먼저** 한다. 잔액이 모자라 거절될 것이면
              MinIO 에 쓰레기를 안 남긴다. */
        int paidCat = chargeIfOverDailyLimit(userId, idempotencyKey);

        byte[] sketch = codec.decodeSketch(request.sketchBase64());
        String sketchKey = fileStorageService.uploadBytes(sketch, SKETCH_DIRECTORY, StickerImageCodec.CONTENT_TYPE);

        try {
            StickerJob job = jobWriter.insert(userId, idempotencyKey, sketchKey,
                    request.subject(), seedOf(request), request.inkColor(), paidCat);
            return new StickerCreateResponse(job.getId(), remainingToday(userId));
        } catch (DataIntegrityViolationException e) {
            // 같은 키가 동시에 두 번 들어왔다. 먼저 들어온 쪽이 이겼으므로 그 작업을 돌려주고,
            // 방금 올린 낙서는 아무도 가리키지 않으므로 지운다
            fileStorageService.delete(sketchKey);

            StickerJob winner = jobRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey)
                    .orElseThrow(() -> e);
            return new StickerCreateResponse(winner.getId(), remainingToday(userId));
        }
    }

    /**
     * 하루 무료 몫을 넘겼으면 캣머니를 태운다.
     *
     * <p>🔴 <b>멱등키를 그대로 원장 키로 쓴다.</b> 같은 요청이 재시도로 두 번 들어와도
     * {@code CatMoneyService.burn} 이 같은 키를 알아보고 <b>두 번 태우지 않는다.</b>
     *
     * <p>⚠️ 잔액을 먼저 보고 거절한다. 안 보면 체인이 거절하는데, 그때는 사용자에게
     * "왜 안 되는지" 를 설명할 수 없는 에러가 나간다.
     *
     * @return 이번에 태운 금액. 무료 몫 안이면 0
     */
    private int chargeIfOverDailyLimit(Long userId, String idempotencyKey) {
        if (usedToday(userId) < properties.dailyLimit()) {
            return 0;
        }
        int price = properties.extraPriceCat();
        if (holdService.availableBalance(userId) < price) {
            throw new BusinessException(StickerErrorCode.NOT_ENOUGH_CAT);
        }
        catMoneyService.burn(userId, BigInteger.valueOf(price),
                CatTxReason.STICKER_CREATE, "sticker:create:" + idempotencyKey);
        return price;
    }

    @Transactional(readOnly = true)
    public StickerJobResponse job(Long userId, Long jobId) {
        StickerJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new BusinessException(StickerErrorCode.JOB_NOT_FOUND));

        if (!job.isOwnedBy(userId)) {
            throw new BusinessException(StickerErrorCode.NOT_OWNED);
        }

        StickerResponse sticker = job.isDone()
                ? stickerRepository.findByJobId(jobId).map(imageResolver::toResponse).orElse(null)
                : null;

        return StickerJobResponse.of(job, sticker);
    }

    @Transactional(readOnly = true)
    public StickerQuotaResponse quota(Long userId) {
        return StickerQuotaResponse.of(properties.dailyLimit(), usedToday(userId),
                properties.extraPriceCat());
    }

    /**
     * 내 스티커 목록. 🔴 <b>소모한 것도 함께</b> 나온다 — 무엇을 만들었는지 기록이 남는다
     * (응답의 {@code used} 로 갈라 보여준다).
     */
    @Transactional(readOnly = true)
    public List<StickerResponse> mine(Long userId) {
        return imageResolver.toResponses(
                stickerRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId));
    }

    /**
     * 꾸미기 서랍용 — <b>아직 안 쓴 것만</b>.
     *
     * <p>소모한 것을 서랍에 띄우면 눌러도 거절당하는 칸이 된다. 애초에 안 보여준다.
     */
    @Transactional(readOnly = true)
    public List<StickerResponse> unused(Long userId) {
        return imageResolver.toResponses(
                stickerRepository.findByUserIdAndUsedAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(userId));
    }

    /**
     * 소프트 삭제. 🔴 MinIO 오브젝트는 지우지 않는다 — 신고 대응용이고, 실수로 지운 것도 되살릴 수 있다.
     *
     * <p>이미 지운 것을 또 지르면 404 다. 멱등하게 200 을 주면 프론트 캐시가 틀어진 걸 아무도 모른다.
     */
    @Transactional
    public void delete(Long userId, Long stickerId) {
        Sticker sticker = stickerRepository.findById(stickerId)
                .orElseThrow(() -> new BusinessException(StickerErrorCode.STICKER_NOT_FOUND));

        if (!sticker.isOwnedBy(userId)) {
            throw new BusinessException(StickerErrorCode.NOT_OWNED);
        }

        if (sticker.isDeleted()) {
            throw new BusinessException(StickerErrorCode.STICKER_NOT_FOUND);
        }

        sticker.softDelete();
    }

    /** 실패한 작업은 세지 않는다 — 워커 장애로 사용자 몫이 깎이면 안 된다 */
    private long usedToday(Long userId) {
        LocalDate today = LocalDate.now(KST);

        // 컬럼이 TIMESTAMPTZ(시점)라 어느 오프셋으로 표현하든 같은 순간이다.
        // 중요한 건 경계를 **KST 자정**으로 잡는 것이고, 그건 위 KST 상수가 한다
        OffsetDateTime from = today.atStartOfDay(KST).toOffsetDateTime();
        OffsetDateTime to = today.plusDays(1).atStartOfDay(KST).toOffsetDateTime();

        return jobRepository.countUsedToday(userId, from, to);
    }

    private int remainingToday(Long userId) {
        return Math.max(0, properties.dailyLimit() - (int) usedToday(userId));
    }

    /**
     * 🔴 seed 를 null 로 두지 않는다. 워커는 seed 가 없으면 자기 기본값을 쓰고,
     * 그러면 "다시 만들기" 가 같은 낙서로 <b>같은 그림</b>을 돌려준다.
     */
    private static int seedOf(StickerCreateRequest request) {
        return request.seed() != null
                ? request.seed()
                : ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE);
    }

    private static String parseIdempotencyKey(String header) {
        try {
            return UUID.fromString(header).toString();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BusinessException(StickerErrorCode.INVALID_IDEMPOTENCY_KEY);
        }
    }
}
