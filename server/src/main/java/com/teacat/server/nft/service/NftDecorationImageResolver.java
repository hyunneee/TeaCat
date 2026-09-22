package com.teacat.server.nft.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.dto.response.NftDecorationResponse;
import com.teacat.server.nft.entity.NftPhotocardDecoration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

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

    public NftDecorationResponse toResponse(NftPhotocardDecoration decoration) {
        return NftDecorationResponse.of(decoration, url(decoration));
    }

    public String url(NftPhotocardDecoration decoration) {
        return fileStorageService.presignedUrl(decoration.getImageKey());
    }
}
