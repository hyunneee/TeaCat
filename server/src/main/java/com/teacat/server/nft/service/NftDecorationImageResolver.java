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
 * <p>presigned URL 은 만료되므로 DB 에 저장하지 않고 <b>조회할 때마다</b> 만든다.
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

    public String url(NftPhotocardDecoration decoration) {
        return fileStorageService.presignedUrl(decoration.getImageKey());
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
