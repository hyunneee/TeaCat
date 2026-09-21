package com.teacat.server.nft.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.common.storage.ImageFiles;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 도안 그림을 <b>화면이 보는 곳</b>에 둔다. 온체인 정본(IPFS 핀)과는 별개다.
 *
 * <p>같은 그림이 두 곳에 산다. 역할이 다르기 때문이다.
 *
 * <table border="1">
 *   <caption>도안 그림의 두 사본</caption>
 *   <tr><th></th><th>IPFS 핀 (Pinata)</th><th>MinIO 공개 경로</th></tr>
 *   <tr><td>누가 보나</td><td>외부 지갑·마켓</td><td>우리 화면</td></tr>
 *   <tr><td>주소</td><td>{@code ipfs://<cid>} (메타데이터 JSON 안)</td><td>{@code designs.image_url}</td></tr>
 *   <tr><td>없으면</td><td>지갑에서 카드가 깨진다. 영구히</td><td>게이트웨이로 폴백</td></tr>
 * </table>
 *
 * <p><b>왜 MinIO 사본이 필요한가.</b> 예전에는 화면도 Pinata 게이트웨이를 직접 봤다.
 * 2026-09-21 전용 게이트웨이가 무료 플랜 한도를 넘겨 403 을 뱉자 <b>포토카드가 뜨는 모든
 * 화면이 한꺼번에 시드 SVG 로 떨어졌다.</b> 브라우저와 Pinata 사이에 우리 코드가 없어서
 * 게이트웨이를 바꾸려면 DB 를 UPDATE 해야 했고, 캐싱도 장애 대응도 걸 자리가 없었다.
 *
 * <p>🔴 <b>핀을 대체하지 않는다.</b> 체인에 박힌 {@code ipfs://} 는 {@code setURI} 가 없어
 * 영원히 못 바꾼다. 핀을 끊으면 지갑에서 카드가 깨지고 복구할 방법이 없다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftPhotocardImageStore {

    /**
     * 🔴 이 접두사에만 익명 읽기 정책이 걸려 있다
     * ({@code mc anonymous set download <별칭>/<버킷>/public/photocards}).
     * 바꾸면 업로드는 되고 <b>조회만 403</b> 이 나므로, 바꿀 때 배포 환경의 정책도 같이 옮겨야 한다.
     */
    static final String KEY_PREFIX = "public/photocards/";

    private final FileStorageService fileStorageService;

    /**
     * 그림을 MinIO 공개 경로에 두고 화면이 쓸 주소를 돌려준다.
     *
     * <p><b>실패해도 예외를 던지지 않는다.</b> 이 사본은 화면 편의지 NFT 의 성립 조건이 아니다 —
     * CID 는 이미 손에 있고 온체인 등록도 그 CID 로 된다. 여기서 막아 세우면 MinIO 가 잠깐
     * 흔들릴 때 어드민이 도안을 아예 못 만든다. 대신 {@code fallbackUrl} 로 물러서고
     * {@code ERROR} 로 남긴다 (Sentry 이슈가 된다 — server/CLAUDE.md 9장).
     *
     * <p>폴백으로 남은 행은 {@code image_cid} 가 그대로라 나중에 배치로 되잡을 수 있다.
     *
     * @param imageCid    핀이 끝나 이미 확정된 CID. <b>키로 쓴다</b> — 내용 주소라 같은 그림이면
     *                    키도 같아 중복이 자동으로 정리되고, 어느 원본인지 추적된다
     * @param fallbackUrl MinIO 가 실패했을 때 대신 쓸 주소(게이트웨이 주소)
     */
    public String store(MultipartFile file, String imageCid, String fallbackUrl) {
        String key = KEY_PREFIX + imageCid + ImageFiles.extensionOf(file.getContentType());

        try {
            /* 핀 단계에서 이미 한 번 읽었지만 MultipartFile 은 다시 읽을 수 있다
               (서블릿 Part 가 매번 새 스트림을 준다). 바이트를 들고 다니지 않는 쪽이
               호출부가 단순하고, 도안 이미지는 5MB 한도라 두 번 읽어도 부담이 없다. */
            return fileStorageService.uploadPublic(file.getBytes(), key, file.getContentType());
        } catch (Exception e) {
            log.error("도안 그림을 MinIO 에 올리지 못했습니다. 게이트웨이 주소로 둡니다 cid={}", imageCid, e);
            return fallbackUrl;
        }
    }
}
