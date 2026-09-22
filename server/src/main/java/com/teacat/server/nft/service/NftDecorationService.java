package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.dto.request.NftDecorationSaveRequest;
import com.teacat.server.nft.dto.response.NftDecorationResponse;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardDecoration;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardDecorationRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 포카 꾸미기 — 저장·조회·삭제.
 *
 * <p>🔴 <b>조회는 언제나 (카드, 사용자) 두 칸으로 한다.</b> 카드만으로 찾으면 주인이 바뀐 뒤
 * 새 주인 화면에 예전 주인의 그림이 뜬다. <b>유출을 막는 건 이 조건이지, 판매 시 삭제가
 * 아니다</b> — 삭제는 저장공간 정리다.
 *
 * <p>합성은 <b>클라이언트가</b> 캔버스로 한다. 서버는 받은 PNG 를 MinIO 에 올리고 배치
 * 정보를 함께 보관할 뿐이다. 서버에 이미지 합성 기구를 두지 않으려는 것이다.
 */
@Service
@RequiredArgsConstructor
public class NftDecorationService {

    private static final String DIRECTORY = "photocard/decoration";
    private static final String CONTENT_TYPE = "image/png";
    /** 카드 한 장 합성본. 스티커 결과물(8MB)과 같은 자리에 둔다 */
    private static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    private final NftPhotocardDecorationRepository decorationRepository;
    private final NftPhotocardRepository photocardRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final NftDecorationImageResolver imageResolver;

    /**
     * 저장하거나 덮어쓴다. 카드당(사람당) 하나다.
     *
     * <p>🔴 덮어쓸 때 <b>예전 MinIO 객체를 지운다.</b> 안 지우면 다시 꾸밀 때마다 안 쓰는
     * 이미지가 한 장씩 쌓인다.
     */
    @Transactional
    public NftDecorationResponse save(Long userId, Long photocardId, NftDecorationSaveRequest request) {
        NftPhotocard photocard = ownedCard(userId, photocardId);
        byte[] image = decode(request.imageBase64());

        String newKey = fileStorageService.uploadBytes(image, DIRECTORY, CONTENT_TYPE);

        Optional<NftPhotocardDecoration> existing =
                decorationRepository.findByPhotocardIdAndUserId(photocardId, userId);

        NftPhotocardDecoration decoration;
        if (existing.isPresent()) {
            decoration = existing.get();
            String oldKey = decoration.getImageKey();
            decoration.update(newKey, request.placements());
            fileStorageService.delete(oldKey);
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
            decoration = decorationRepository.save(
                    NftPhotocardDecoration.of(photocard, user, newKey, request.placements()));
        }
        return imageResolver.toResponse(decoration);
    }

    /** 다시 꾸미기용. 꾸민 적이 없으면 404 이고, 그건 화면에서 정상 상태다 */
    @Transactional(readOnly = true)
    public NftDecorationResponse find(Long userId, Long photocardId) {
        return decorationRepository.findByPhotocardIdAndUserId(photocardId, userId)
                .map(imageResolver::toResponse)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DECORATION_NOT_FOUND));
    }

    @Transactional
    public void delete(Long userId, Long photocardId) {
        NftPhotocardDecoration decoration = decorationRepository
                .findByPhotocardIdAndUserId(photocardId, userId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DECORATION_NOT_FOUND));
        String key = decoration.getImageKey();
        decorationRepository.delete(decoration);
        fileStorageService.delete(key);
    }

    /**
     * 목록 화면용 — 카드 여러 장의 꾸민 그림 주소를 한 번에 가져온다.
     *
     * <p>🔴 카드마다 따로 부르면 <b>N+1</b> 이다. 도감이 수십 장이라 그대로 드러난다.
     */
    @Transactional(readOnly = true)
    public Map<Long, String> imageUrlsOf(Long userId, List<Long> photocardIds) {
        if (userId == null || photocardIds == null || photocardIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> urls = new HashMap<>();
        for (NftPhotocardDecoration d : decorationRepository.findByUserIdAndPhotocardIdIn(userId, photocardIds)) {
            urls.put(d.getPhotocard().getId(), imageResolver.url(d));
        }
        return urls;
    }

    /** 한 장짜리 편의 메서드. 상세 화면에서 쓴다 */
    @Transactional(readOnly = true)
    public String imageUrlOf(Long userId, Long photocardId) {
        return imageUrlsOf(userId, List.of(photocardId)).get(photocardId);
    }

    private NftPhotocard ownedCard(Long userId, Long photocardId) {
        NftPhotocard photocard = photocardRepository.findById(photocardId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        if (!photocard.isOwnedBy(userId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_NOT_OWNED);
        }
        return photocard;
    }

    /**
     * 🔴 <b>디코드한 바이트 기준</b>으로 크기를 본다. base64 문자열 길이로 재면 실제보다 1/3
     * 크게 나오고, 무엇보다 막으려던 크기를 이미 힙에 올린 뒤가 된다.
     */
    private byte[] decode(String base64) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(NftErrorCode.DECORATION_IMAGE_INVALID);
        }
        if (bytes.length == 0) {
            throw new BusinessException(NftErrorCode.DECORATION_IMAGE_INVALID);
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new BusinessException(NftErrorCode.DECORATION_IMAGE_TOO_LARGE);
        }
        return bytes;
    }
}
