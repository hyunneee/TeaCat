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
 * 포카 꾸미기 — 저장·조회.
 *
 * <p>🔴 <b>꾸밈은 카드의 일부다.</b> 카드 하나에 하나이고, 카드가 팔리면 <b>함께 넘어간다.</b>
 * 그래서 조회에 사용자 조건이 없다 — 마켓에서도 꾸민 모습이 보이고 사는 사람이 그대로 받는다.
 *
 * <p>⚠️ 2026-09-22 에는 정반대였다(만든 사람 것, 팔리면 삭제, 사람으로 걸러 조회).
 * 2026-09-23 에 뒤집혔다 — 마켓에 꾸민 모습을 보여주면서 맨 카드를 넘기면 <b>사는 사람이
 * 속는다.</b> 보이는 것과 받는 것을 같게 맞췄다.
 *
 * <p>🔴 <b>고칠 권한은 "만든 사람" 이 아니라 "현재 카드 주인" 이다.</b> 산 사람이 물려받은
 * 꾸밈을 덮어쓸 수 있어야 한다. {@code user_id} 는 이제 접근 열쇠가 아니라 기록일 뿐이다.
 *
 * <p>합성은 <b>클라이언트가</b> 캔버스로 한다. 서버는 받은 PNG 를 MinIO 에 올리고 배치
 * 정보를 함께 보관할 뿐이다. 서버에 이미지 합성 기구를 두지 않으려는 것이다.
 */
@Service
@RequiredArgsConstructor
public class NftDecorationService {

    /**
     * 🔴 도안 그림과 같은 공개 접두사({@link NftPhotocardImageStore#KEY_PREFIX}) 아래에 둔다.
     * 그 접두사에 걸린 익명 읽기 정책을 그대로 쓰려는 것이다 — 밖으로 빼면 조회가 403 이 난다.
     *
     * <p>공개로 두는 이유: 꾸민 모습은 마켓에서 누구에게나 보이는 그림이라 서명이 지킬 것이 없고,
     * presigned 는 조회마다 주소가 바뀌어 <b>브라우저·서비스워커 캐시가 한 번도 맞지 않았다</b>
     * (2026-09-29). 예전 key({@code photocard/decoration/...})는 {@link NftDecorationImageResolver}
     * 가 계속 presigned 로 내려준다.
     */
    static final String DIRECTORY = NftPhotocardImageStore.KEY_PREFIX + "decorations";
    private static final String CONTENT_TYPE = "image/png";
    /** 카드 한 장 합성본. 스티커 결과물(8MB)과 같은 자리에 둔다 */
    private static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    private final NftPhotocardDecorationRepository decorationRepository;
    private final NftPhotocardRepository photocardRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final NftDecorationImageResolver imageResolver;
    private final NftDecorationStickerBinder stickerBinder;

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

        /* 🔴 스티커 소모를 **이미지 업로드보다 먼저** 한다. 여기서 거절되면 MinIO 에 쓰레기가
           안 남는다. 순서를 바꾸면 "스티커가 안 쓰였는데 이미지만 올라간" 파일이 쌓인다. */
        stickerBinder.bind(userId, photocardId, request.placements());

        String newKey = fileStorageService.uploadPublicBytes(image, DIRECTORY, CONTENT_TYPE);

        Optional<NftPhotocardDecoration> existing =
                decorationRepository.findByPhotocardId(photocardId);

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

    /**
     * 다시 꾸미기용. 꾸민 적이 없으면 404 이고, 그건 화면에서 정상 상태다.
     *
     * <p>🔴 <b>누구나 볼 수 있다.</b> 꾸밈은 카드의 일부라 숨길 것이 아니다.
     */
    @Transactional(readOnly = true)
    public NftDecorationResponse find(Long photocardId) {
        return decorationRepository.findByPhotocardId(photocardId)
                .map(imageResolver::toResponse)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DECORATION_NOT_FOUND));
    }

    /*
     * 🔴 꾸밈 삭제는 **없앴다** (2026-09-23).
     *
     * 스티커는 붙이면 못 떼는데 꾸밈을 통째로 지울 수 있으면 <b>그 스티커들이 증발한다.</b>
     * 되돌릴 방법이 없는 소모라, 지우는 길 자체를 두지 않는다.
     */

    /**
     * 목록 화면용 — 카드 여러 장의 꾸민 그림 주소를 한 번에 가져온다.
     *
     * <p>🔴 카드마다 따로 부르면 <b>N+1</b> 이다. 도감이 수십 장이라 그대로 드러난다.
     */
    @Transactional(readOnly = true)
    public Map<Long, String> imageUrlsOf(List<Long> photocardIds) {
        if (photocardIds == null || photocardIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> urls = new HashMap<>();
        for (NftPhotocardDecoration d : decorationRepository.findByPhotocardIdIn(photocardIds)) {
            urls.put(d.getPhotocard().getId(), imageResolver.url(d));
        }
        return urls;
    }

    /** 한 장짜리 편의 메서드. 상세 화면에서 쓴다 */
    @Transactional(readOnly = true)
    public String imageUrlOf(Long photocardId) {
        return imageUrlsOf(List.of(photocardId)).get(photocardId);
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
