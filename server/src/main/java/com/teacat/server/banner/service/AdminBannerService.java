package com.teacat.server.banner.service;

import com.teacat.server.banner.dto.request.BannerOrderRequest;
import com.teacat.server.banner.dto.request.BannerWriteRequest;
import com.teacat.server.banner.dto.response.AdminBannerResponse;
import com.teacat.server.banner.dto.response.BannerUploadUrlResponse;
import com.teacat.server.banner.entity.MainBanner;
import com.teacat.server.banner.entity.MainBannerType;
import com.teacat.server.banner.exception.BannerErrorCode;
import com.teacat.server.banner.repository.MainBannerRepository;
import com.teacat.server.common.config.BannerImageProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 배너 관리 (ADMIN 전용).
 *
 * /admin/** 는 SecurityConfig 의 포괄 규칙이 ADMIN 으로 잠근다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminBannerService {

    private static final String IMAGE_DIRECTORY = "banner";

    private final MainBannerRepository mainBannerRepository;
    private final PerformanceGeneralRepository performanceGeneralRepository;
    private final FileStorageService fileStorageService;
    private final BannerImageProperties bannerImageProperties;
    private final BannerImageResolver bannerImageResolver;

    public List<AdminBannerResponse> getAll() {
        return mainBannerRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(banner -> AdminBannerResponse.of(banner, bannerImageResolver.resolveImageUrl(banner)))
                .toList();
    }

    public BannerUploadUrlResponse issueUploadUrl(String contentType) {
        // 한도를 함께 내려줘야 클라이언트가 올리기 전에 걸러 준다. 올린 뒤 거절되면 대역폭만 낭비다
        return BannerUploadUrlResponse.of(
                fileStorageService.presignedUploadUrl(IMAGE_DIRECTORY, contentType),
                bannerImageProperties.maxSize());
    }

    @Transactional
    public AdminBannerResponse create(BannerWriteRequest request) {
        // 새 배너는 맨 뒤에 붙인다. 순서는 목록에서 따로 바꾼다
        int sortOrder = mainBannerRepository.findMaxSortOrder() + 1;

        MainBanner banner = request.type() == MainBannerType.IMAGE
                ? MainBanner.ofImage(request.title(), request.subtitle(), request.label(),
                requireUploadedImage(request.imageKey()), request.linkPath(), sortOrder, request.active())
                : MainBanner.ofPerformance(request.title(), request.subtitle(), request.label(),
                requirePerformance(request.performanceId()), sortOrder, request.active());

        return toResponse(mainBannerRepository.save(banner));
    }

    @Transactional
    public AdminBannerResponse update(Long bannerId, BannerWriteRequest request) {
        MainBanner banner = getBanner(bannerId);
        String previousImageKey = banner.getImageKey();

        banner.editText(request.title(), request.subtitle(), request.label());
        banner.changeActive(request.active());

        if (request.type() == MainBannerType.IMAGE) {
            banner.changeToImage(requireUploadedImage(request.imageKey()), request.linkPath());
        } else {
            banner.changeToPerformance(requirePerformance(request.performanceId()));
        }

        // 그림을 갈아끼웠으면 옛 파일은 아무도 안 본다. 지워도 배너는 이미 새 것을 가리킨다
        if (previousImageKey != null && !previousImageKey.equals(banner.getImageKey())) {
            deleteQuietly(previousImageKey);
        }

        return toResponse(banner);
    }

    @Transactional
    public void delete(Long bannerId) {
        MainBanner banner = getBanner(bannerId);
        String imageKey = banner.getImageKey();

        mainBannerRepository.delete(banner);

        // 배너 행은 이미 지워졌다. 파일 삭제가 실패해도 요청 전체를 되돌리지 않는다
        if (imageKey != null) {
            deleteQuietly(imageKey);
        }
    }

    /**
     * 순서 변경.
     *
     * 지금 있는 배너 전부를 받는다. 일부만 오면 빠진 배너의 자리가 애매해지고,
     * 그 사이 다른 관리자가 배너를 추가·삭제했다면 순서가 뒤엉킨다. 그래서 개수와 구성을 먼저 확인한다.
     */
    @Transactional
    public List<AdminBannerResponse> reorder(BannerOrderRequest request) {
        List<MainBanner> banners = mainBannerRepository.findAllByOrderBySortOrderAscIdAsc();

        Set<Long> requested = new HashSet<>(request.bannerIds());
        Set<Long> existing = banners.stream().map(MainBanner::getId).collect(Collectors.toSet());

        if (requested.size() != request.bannerIds().size() || !requested.equals(existing)) {
            throw new BusinessException(BannerErrorCode.ORDER_MISMATCH);
        }

        Map<Long, MainBanner> byId = banners.stream()
                .collect(Collectors.toMap(MainBanner::getId, Function.identity()));

        for (int order = 0; order < request.bannerIds().size(); order++) {
            byId.get(request.bannerIds().get(order)).changeSortOrder(order);
        }

        return getAll();
    }

    private MainBanner getBanner(Long bannerId) {
        return mainBannerRepository.findById(bannerId)
                .orElseThrow(() -> new BusinessException(BannerErrorCode.BANNER_NOT_FOUND));
    }

    /** 올렸다고 한 파일이 실제로 있는지, 한도를 넘지 않았는지 확인한다 */
    private String requireUploadedImage(String imageKey) {
        if (!StringUtils.hasText(imageKey)) {
            throw new BusinessException(BannerErrorCode.IMAGE_REQUIRED);
        }

        OptionalLong size = fileStorageService.objectSize(imageKey);

        if (size.isEmpty()) {
            throw new BusinessException(BannerErrorCode.IMAGE_NOT_UPLOADED);
        }
        if (size.getAsLong() > bannerImageProperties.maxSize().toBytes()) {
            deleteQuietly(imageKey);
            throw new BusinessException(BannerErrorCode.IMAGE_TOO_LARGE);
        }

        return imageKey;
    }

    private PerformanceGeneral requirePerformance(Long performanceId) {
        if (performanceId == null) {
            throw new BusinessException(BannerErrorCode.PERFORMANCE_REQUIRED);
        }

        return performanceGeneralRepository.findById(performanceId)
                .orElseThrow(() -> new BusinessException(BannerErrorCode.PERFORMANCE_NOT_FOUND));
    }

    private void deleteQuietly(String key) {
        try {
            fileStorageService.delete(key);
        } catch (RuntimeException e) {
            log.warn("배너 이미지 삭제 실패. 고아 파일로 남는다. key={}", key, e);
        }
    }

    private AdminBannerResponse toResponse(MainBanner banner) {
        return AdminBannerResponse.of(banner, bannerImageResolver.resolveImageUrl(banner));
    }
}
