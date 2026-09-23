package com.teacat.server.nft.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.sticker.entity.Sticker;
import com.teacat.server.sticker.repository.StickerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 꾸미기 저장에서 <b>스티커 소모</b>를 맡는다.
 *
 * <p>규칙은 셋이다:
 * <ol>
 *   <li>배치에 실린 스티커는 <b>내 것</b>이어야 한다</li>
 *   <li>이미 <b>다른 카드</b>에 쓴 스티커는 못 쓴다 — 하나는 한 번뿐이다</li>
 *   <li>🔴 이 카드에 <b>이미 붙어 있는 것을 빼면 거절</b>한다 — "붙이면 못 뗀다"</li>
 * </ol>
 *
 * <p>🔴 <b>배치 JSON 을 서버가 직접 읽는다.</b> "이번에 소모할 id" 를 클라이언트가 따로
 * 보내게 하면, 그 목록만 비워 보내서 <b>스티커를 안 쓰고 붙일 수 있다.</b> 무엇을 소모할지는
 * 실제로 저장되는 배치에서만 나와야 한다.
 *
 * <p>⚠️ 서버가 배치 스키마를 아주 조금 알게 된다 — {@code stickerId} 라는 이름 하나다.
 * 프론트에서 그 필드명을 바꾸면 여기도 같이 바꿔야 한다.
 */
@Component
@RequiredArgsConstructor
public class NftDecorationStickerBinder {

    private static final String STICKER_ID_FIELD = "stickerId";

    /* 🔴 앱의 ObjectMapper 를 **주입받지 않는다.** 여기서 읽는 것은 {stickerId} 하나뿐이라
       앱 설정(날짜 형식·네이밍 전략)이 필요 없고, 주입하면 이 클래스가 웹 설정에 묶인다 —
       실제로 테스트 컨텍스트에 ObjectMapper 빈이 없어 컨텍스트가 통째로 안 떴다. */
    private static final ObjectMapper JSON = new ObjectMapper();

    private final StickerRepository stickerRepository;

    /**
     * 배치에 실린 스티커를 확인하고 아직 안 쓴 것을 소모한다.
     *
     * @return 이번 저장으로 새로 소모한 스티커 수 (0 이면 자리만 옮긴 것)
     */
    public int bind(Long userId, Long photocardId, String placementsJson) {
        List<Long> stickerIds = parseStickerIds(placementsJson);

        // ③ 이미 붙어 있는 것을 빼지 않았는가 — 먼저 본다. 소모보다 이 검사가 앞서야
        //    "빼면서 새로 붙이기" 가 절반만 반영되는 일이 없다.
        Set<Long> kept = new LinkedHashSet<>(stickerIds);
        for (Sticker already : stickerRepository.findByUsedPhotocardId(photocardId)) {
            if (!kept.contains(already.getId())) {
                throw new BusinessException(NftErrorCode.DECORATION_STICKER_NOT_REMOVABLE);
            }
        }

        if (stickerIds.isEmpty()) {
            return 0;
        }

        Map<Long, Sticker> found = stickerRepository.findByIdInAndDeletedAtIsNull(stickerIds).stream()
                .collect(Collectors.toMap(Sticker::getId, Function.identity()));

        int consumed = 0;
        for (Long id : stickerIds) {
            Sticker sticker = found.get(id);
            if (sticker == null) {
                throw new BusinessException(NftErrorCode.DECORATION_STICKER_NOT_USABLE);
            }
            /* 🔴 **이 카드에 이미 붙어 있으면 소유를 묻지 않는다.** 소모된 스티커는 카드의
               일부가 되어 카드를 따라가므로, 카드를 산 사람에게는 "남의 스티커" 가 아니다.
               ⚠️ 소유 검사를 먼저 두었더니 **새 주인이 물려받은 카드에 아무것도 못 더했다** —
                  판 사람의 스티커를 배치에서 뺄 수도 없는데(못 뗀다) 넣으면 거절당했다.
                  순서가 규칙이다. */
            if (sticker.isUsedOn(photocardId)) {
                continue;
            }
            // 새로 붙이는 것만 내 것이어야 한다
            if (!sticker.isOwnedBy(userId)) {
                throw new BusinessException(NftErrorCode.DECORATION_STICKER_NOT_USABLE);
            }
            // 다른 카드에 이미 쓴 것
            if (sticker.isUsed()) {
                throw new BusinessException(NftErrorCode.DECORATION_STICKER_ALREADY_USED);
            }
            sticker.consume(photocardId);
            consumed++;
        }
        return consumed;
    }

    /**
     * 배치 JSON 에서 {@code stickerId} 만 뽑는다. 나머지 필드(좌표·크기·각도)는 서버가 모른다.
     *
     * <p>같은 스티커를 두 번 올린 배치는 거절한다 — 한 장을 둘로 쓸 수는 없다.
     */
    private List<Long> parseStickerIds(String placementsJson) {
        JsonNode root;
        try {
            root = JSON.readTree(placementsJson);
        } catch (Exception e) {
            throw new BusinessException(NftErrorCode.DECORATION_PLACEMENTS_INVALID);
        }
        if (!root.isArray()) {
            throw new BusinessException(NftErrorCode.DECORATION_PLACEMENTS_INVALID);
        }
        List<Long> ids = new ArrayList<>();
        for (JsonNode node : root) {
            JsonNode field = node.get(STICKER_ID_FIELD);
            if (field == null || !field.canConvertToLong()) {
                throw new BusinessException(NftErrorCode.DECORATION_PLACEMENTS_INVALID);
            }
            Long id = field.asLong();
            if (ids.contains(id)) {
                throw new BusinessException(NftErrorCode.DECORATION_STICKER_ALREADY_USED);
            }
            ids.add(id);
        }
        return ids;
    }
}
