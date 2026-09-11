package com.teacat.server.banner.service;

import com.teacat.server.banner.entity.MainBanner;
import com.teacat.server.common.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 배너가 어떤 그림을 보여줄지 한 곳에서 정한다.
 *
 *   IMAGE       직접 올린 이미지
 *   PERFORMANCE 그 공연의 포스터
 *
 * 홈과 관리 화면이 서로 다른 그림을 보여주면 등록해 놓고 결과를 확인할 수 없으므로
 * 두 응답이 같은 규칙을 쓰게 여기로 모은다.
 *
 * presigned URL 은 만료되므로 저장하지 않고 조회할 때마다 만든다.
 */
@Component
@RequiredArgsConstructor
public class BannerImageResolver {

    private final FileStorageService fileStorageService;

    /** 이미지가 없으면 null (포스터를 아직 안 올린 공연일 수 있다) */
    public String resolveImageUrl(MainBanner banner) {
        String key = banner.isImageType()
                ? banner.getImageKey()
                : (banner.getPerformance() == null ? null : banner.getPerformance().getPosterImageKey());

        return StringUtils.hasText(key) ? fileStorageService.presignedUrl(key) : null;
    }
}
