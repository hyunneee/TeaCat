package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.request.StickerJobCompleteRequest;
import com.teacat.server.sticker.dto.request.StickerJobFailRequest;
import com.teacat.server.sticker.dto.response.StickerJobClaimResponse;
import com.teacat.server.sticker.entity.Sticker;
import com.teacat.server.sticker.entity.StickerFailReason;
import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.exception.StickerErrorCode;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.sticker.repository.StickerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Optional;

/**
 * 워커(GPU 노트북)가 부르는 API 의 알맹이.
 *
 * <p>사람이 아니라 남의 프로세스가 부른다. 로그인 세션이 없어 {@code X-Internal-Api-Key}
 * 헤더 하나로 인증한다 — {@code SecurityConfig} 의 {@code /internal/**} 은 스프링 시큐리티를
 * 통과시키므로 <b>키 검사를 빠뜨리면 인터넷에 그대로 열린 API 가 된다.</b>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StickerJobWorkerService {

    private static final String RESULT_DIRECTORY = "sticker/result";

    private final StickerJobRepository jobRepository;
    private final StickerRepository stickerRepository;
    private final FileStorageService fileStorageService;
    private final StickerImageCodec codec;
    private final StickerProperties properties;
    private final ObjectMapper objectMapper;

    /**
     * 내부 API 키 검사.
     *
     * <p>🔴 <b>키가 설정돼 있지 않으면 무조건 거절한다.</b> "비었으면 통과" 로 만들면
     * 운영에 키를 안 넣은 실수가 곧 열린 API 다.
     *
     * <p>비교는 {@link MessageDigest#isEqual} 로 한다. {@code String.equals} 는 처음 다른
     * 글자에서 끊겨 걸린 시간이 정답의 접두사 길이를 흘린다.
     */
    public void verifyKey(String provided) {
        if (!properties.hasInternalApiKey()) {
            log.warn("스티커 내부 API 키가 설정되지 않아 워커 요청을 거절했습니다. STICKER_INTERNAL_API_KEY 를 확인하세요.");
            throw new BusinessException(StickerErrorCode.INVALID_INTERNAL_KEY);
        }

        if (provided == null || !MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                properties.internalApiKey().getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(StickerErrorCode.INVALID_INTERNAL_KEY);
        }
    }

    /**
     * 일감 하나를 집어 준다. 없으면 비어 있다(컨트롤러가 204 로 바꾼다).
     *
     * <p>낙서를 MinIO 에서 읽어 base64 로 실어 보낸다. presigned URL 로 주소만 줄 수도 있지만,
     * 그러면 워커가 API 말고 MinIO 에도 닿아야 한다 — 캠퍼스 GPU 서버에 붙일 때 뚫을 구멍이 하나 더 는다.
     *
     * <p>⚠️ MinIO 읽기가 트랜잭션 안에 있다. 워커가 한둘이고 초당 한 번 부르는 규모라
     * 커넥션을 잠깐 쥐는 값이 쪼개는 복잡함보다 싸다. 워커가 여럿으로 늘면 다시 볼 것.
     */
    @Transactional
    public Optional<StickerJobClaimResponse> claimNext(String workerId) {
        return jobRepository.claimNext(workerId)
                .map(this::loadClaimed);
    }

    /**
     * 결과 도착.
     *
     * <p>이미 {@code DONE} 이면 아무것도 하지 않는다 — 워커가 응답을 못 받고 다시 보낸 것이라
     * 에러가 아니다. 그 밖의 상태는 스위퍼가 되돌린 뒤 늦게 온 결과라 받지 않는다.
     */
    @Transactional
    public void complete(Long jobId, StickerJobCompleteRequest request) {
        StickerJob job = find(jobId);

        if (job.isDone()) {
            log.info("이미 끝난 작업에 결과가 다시 도착했습니다. jobId={}", jobId);
            return;
        }

        requireRunning(job);

        byte[] image = codec.decodeResult(request.imageBase64());
        String imageKey = fileStorageService.uploadBytes(image, RESULT_DIRECTORY, StickerImageCodec.CONTENT_TYPE);

        stickerRepository.save(Sticker.of(job, job.getUser(), imageKey));
        job.complete();

        // 곁다리 기록. 엔티티 변경을 먼저 내보낸 뒤 params_json 만 따로 넣는다
        String meta = serializeMeta(request.meta());
        if (meta != null) {
            jobRepository.saveMeta(job.getId(), meta);
        }
    }

    /**
     * 워커가 "못 만들겠다" 고 신고했다. 재시도하지 않고 바로 실패로 끝낸다 —
     * 워커가 해보고 안 된 것이라 다시 줘도 같은 결과일 가능성이 크다.
     * (말없이 죽은 경우는 스위퍼가 되돌린다)
     */
    @Transactional
    public void fail(Long jobId, StickerJobFailRequest request) {
        StickerJob job = find(jobId);

        if (job.isDone()) {
            log.info("이미 끝난 작업에 실패 신고가 도착했습니다. 무시합니다. jobId={}", jobId);
            return;
        }

        requireRunning(job);

        /* 🔴 원문은 로그에만 남기고 컬럼에는 코드를 넣는다.
           - 프론트는 failReason 을 코드로 다룬다. 남의 프로세스 문장이 화면에 샐 자리가 아니다.
           - 워커 메시지에는 경로·모델명 같은 내부 사정이 섞인다.
           🔴 레벨은 warn 이다. error 로 찍으면 Sentry 이슈가 되어 GPU 의 OOM 하나하나가 알림이 된다. */
        log.warn("워커가 스티커 생성 실패를 신고했습니다. jobId={} workerId={} message={}",
                jobId, job.getWorkerId(), request.message());

        job.fail(StickerFailReason.WORKER_ERROR);
    }

    private StickerJobClaimResponse loadClaimed(Long jobId) {
        StickerJob job = find(jobId);

        return new StickerJobClaimResponse(
                job.getId(),
                codec.encode(fileStorageService.download(job.getSketchKey())),
                job.getSubject(),
                job.getSeed(),
                job.colorChip());
    }

    private StickerJob find(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new BusinessException(StickerErrorCode.JOB_NOT_FOUND));
    }

    private static void requireRunning(StickerJob job) {
        if (!job.isRunning()) {
            throw new BusinessException(StickerErrorCode.JOB_NOT_RUNNING);
        }
    }

    /**
     * 워커가 남긴 기록을 JSON 문자열로 바꾼다. 서버는 읽지 않고 나중에 사람이 들여다볼 값이다.
     *
     * <p>직렬화가 실패해도 작업을 실패로 만들지 않는다 — 그림은 이미 나왔는데 곁다리 기록 때문에
     * 사용자가 결과를 못 받는 건 말이 안 된다.
     */
    private String serializeMeta(Map<String, Object> meta) {
        if (meta == null || meta.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(meta);
        } catch (RuntimeException e) {
            log.warn("워커 meta 를 저장하지 못했습니다. 결과는 그대로 처리합니다. message={}", e.getMessage());
            return null;
        }
    }
}
