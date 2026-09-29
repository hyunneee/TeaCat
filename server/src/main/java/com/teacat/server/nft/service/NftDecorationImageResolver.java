package com.teacat.server.nft.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.dto.response.NftDecorationResponse;
import com.teacat.server.nft.entity.NftPhotocardDecoration;
import com.teacat.server.sticker.entity.Sticker;
import com.teacat.server.sticker.repository.StickerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 꾸밈을 응답 모양으로 바꾼다. {@code StickerImageResolver} · {@code BannerImageResolver} 와
 * 같은 이유로 따로 둔다 — 주소 만드는 규칙이 여러 조회 경로에 흩어지지 않게.
 *
 * <p>꾸민 카드 그림은 공개 고정 주소다({@link #url}). 스티커 그림은 붙기 전까지 만든 사람만
 * 보는 것이라 presigned 로 두고, 만료되므로 DB 에 저장하지 않고 <b>조회할 때마다</b> 만든다.
 * 발급은 MinIO 왕복이 아니라 로컬 서명 계산이라 목록이 길어도 네트워크 호출이 없다.
 */
@Component
@RequiredArgsConstructor
public class NftDecorationImageResolver {

    private final FileStorageService fileStorageService;
    private final StickerRepository stickerRepository;

    public NftDecorationResponse toResponse(NftPhotocardDecoration decoration) {
        Long photocardId = decoration.getPhotocard().getId();
        return NftDecorationResponse.of(decoration, url(decoration), stickerUrlsOn(photocardId));
    }

    /**
     * 꾸민 카드 그림 주소.
     *
     * <p>공개 접두사 아래 key 는 <b>고정 주소</b>를 준다 — 조회마다 같은 주소라 캐시가 맞는다.
     * 2026-09-29 이전에 저장된 key({@code photocard/decoration/...})는 비공개 경로라
     * presigned 로 내려준다. 그 카드를 다시 꾸미면 새 key 가 공개 경로로 가고 예전 것은 지워진다.
     */
    public String url(NftPhotocardDecoration decoration) {
        String key = decoration.getImageKey();
        return key.startsWith(NftPhotocardImageStore.KEY_PREFIX)
                ? fileStorageService.publicObjectUrl(key)
                : fileStorageService.presignedUrl(key);
    }

    /**
     * 이 카드에 붙어 있는 스티커의 그림 주소.
     *
     * <p>🔴 <b>배치 JSON 을 읽지 않는다.</b> 무엇이 붙어 있는지의 진실은
     * {@code stickers.used_photocard_id} 이고, 배치는 그 스티커를 <i>어디에</i> 뒀는지일 뿐이다.
     *
     * <p>🔴 <b>지운 스티커도 포함한다</b>({@code deleted_at} 을 걸러내지 않는다). 소프트 삭제는
     * MinIO 객체를 남기고, 붙은 스티커는 이미 카드의 일부라 만든 사람이 목록에서 치웠다고
     * <b>남의 카드에서 사라지면 안 된다.</b>
     */
    private Map<Long, String> stickerUrlsOn(Long photocardId) {
        List<Sticker> stuck = stickerRepository.findByUsedPhotocardId(photocardId);
        Map<Long, String> urls = new LinkedHashMap<>();
        for (Sticker sticker : stuck) {
            urls.put(sticker.getId(), fileStorageService.presignedUrl(sticker.getImageKey()));
        }
        return urls;
    }
}
