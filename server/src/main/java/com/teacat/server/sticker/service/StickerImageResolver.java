package com.teacat.server.sticker.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.response.StickerResponse;
import com.teacat.server.sticker.entity.Sticker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 스티커를 응답 모양으로 바꾼다. 조회 경로가 셋(작업 조회 · 내 목록 · 삭제 직후)이라
 * 주소 만드는 규칙을 한 곳에 모은다 ({@code BannerImageResolver} 와 같은 이유).
 *
 * <p>presigned URL 은 만료되므로 DB 에 저장하지 않고 <b>조회할 때마다</b> 만든다.
 * 발급은 MinIO 왕복이 아니라 로컬 서명 계산이라 목록이 길어도 네트워크 호출이 없다.
 */
@Component
@RequiredArgsConstructor
public class StickerImageResolver {

    private final FileStorageService fileStorageService;

    public StickerResponse toResponse(Sticker sticker) {
        return StickerResponse.of(sticker, fileStorageService.presignedUrl(sticker.getImageKey()));
    }

    public List<StickerResponse> toResponses(List<Sticker> stickers) {
        return stickers.stream().map(this::toResponse).toList();
    }
}
