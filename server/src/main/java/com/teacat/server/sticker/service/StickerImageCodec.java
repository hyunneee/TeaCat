package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.exception.ErrorCode;
import com.teacat.server.sticker.exception.StickerErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Base64;

/**
 * base64 ↔ PNG 바이트. 낙서(사용자)와 결과(워커) 양쪽이 쓴다.
 *
 * <p>🔴 <b>{@code data:image/png;base64,} 접두어를 반드시 벗겨야 한다.</b> 프론트는 캔버스의
 * {@code toDataURL()} 을 그대로 보내므로 접두어가 붙어 온다. 안 벗기면 디코드가 쓰레기를 만들고,
 * 그 쓰레기는 <b>MinIO 에 성공적으로 올라가서</b> 워커가 열어볼 때까지 아무도 모른다.
 *
 * <p>그래서 형식 판정은 확장자나 content-type 이 아니라 <b>매직바이트</b>로 한다.
 */
@Component
@RequiredArgsConstructor
public class StickerImageCodec {

    /** PNG 파일의 첫 8바이트. 이게 아니면 PNG 가 아니다 */
    private static final byte[] PNG_MAGIC = {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
    };

    private static final String DATA_URL_MARKER = "base64,";

    /** base64 는 3바이트를 4글자로 늘린다. 줄바꿈이 섞일 수 있어 조금 넉넉히 본다 */
    private static final double BASE64_OVERHEAD = 1.40;

    public static final String CONTENT_TYPE = "image/png";

    private final StickerProperties properties;

    /** 사용자가 올린 낙서 */
    public byte[] decodeSketch(String base64) {
        return decode(base64, properties.maxSketchSize().toBytes(),
                StickerErrorCode.INVALID_SKETCH, StickerErrorCode.SKETCH_TOO_LARGE);
    }

    /** 워커가 보낸 결과. 형식이든 크기든 워커가 고칠 일이라 코드를 나누지 않는다 */
    public byte[] decodeResult(String base64) {
        return decode(base64, properties.maxResultSize().toBytes(),
                StickerErrorCode.INVALID_RESULT_IMAGE, StickerErrorCode.INVALID_RESULT_IMAGE);
    }

    /** MinIO 에서 읽은 낙서를 워커에게 내줄 때 */
    public String encode(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private byte[] decode(String base64, long maxBytes, ErrorCode invalid, ErrorCode tooLarge) {
        if (base64 == null || base64.isBlank()) {
            throw new BusinessException(invalid);
        }

        String payload = stripDataUrlPrefix(base64);

        // 디코드하기 전에 길이로 먼저 거른다. 통째로 바이트 배열을 만들고 나서 재면
        // 막으려던 크기를 이미 힙에 올린 뒤가 된다
        if (payload.length() > maxBytes * BASE64_OVERHEAD) {
            throw new BusinessException(tooLarge);
        }

        byte[] decoded;
        try {
            // MIME 디코더는 줄바꿈이 섞여 있어도 받는다. 알파벳 밖 글자는 건너뛰므로
            // 깨진 입력이 여기를 통과할 수 있는데, 그건 바로 아래 매직바이트가 잡는다
            decoded = Base64.getMimeDecoder().decode(payload);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(invalid);
        }

        if (decoded.length > maxBytes) {
            throw new BusinessException(tooLarge);
        }

        if (!isPng(decoded)) {
            throw new BusinessException(invalid);
        }

        return decoded;
    }

    private static String stripDataUrlPrefix(String base64) {
        String trimmed = base64.strip();

        if (!trimmed.startsWith("data:")) {
            return trimmed;
        }

        int marker = trimmed.indexOf(DATA_URL_MARKER);
        return marker < 0 ? trimmed : trimmed.substring(marker + DATA_URL_MARKER.length());
    }

    private static boolean isPng(byte[] bytes) {
        if (bytes.length < PNG_MAGIC.length) {
            return false;
        }

        for (int i = 0; i < PNG_MAGIC.length; i++) {
            if (bytes[i] != PNG_MAGIC[i]) {
                return false;
            }
        }

        return true;
    }
}
