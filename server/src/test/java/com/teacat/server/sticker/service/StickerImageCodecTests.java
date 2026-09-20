package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.sticker.exception.StickerErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * base64 → PNG 바이트.
 *
 * <p>🔴 여기서 제일 중요한 건 <b>data URL 접두어</b>다. 프론트는 캔버스의 {@code toDataURL()} 을
 * 그대로 보내므로 {@code data:image/png;base64,} 가 붙어 온다. 안 벗기면 디코드가 쓰레기를 만들고,
 * 그 쓰레기는 <b>MinIO 에 성공적으로 올라가서</b> 워커가 열어볼 때까지 아무도 모른다.
 * 그래서 형식 판정을 content-type 이 아니라 매직바이트로 한다.
 */
class StickerImageCodecTests {

    /** PNG 의 첫 8바이트 + 아무 내용. 코덱은 머리만 본다 */
    private static final byte[] PNG = {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4
    };

    private static final byte[] NOT_PNG = "이건 그냥 글자입니다".getBytes();

    private static StickerImageCodec codec(long maxBytes) {
        return new StickerImageCodec(new StickerProperties(
                5,
                "test-key",
                DataSize.ofBytes(maxBytes),
                DataSize.ofBytes(maxBytes),
                Duration.ofMinutes(5),
                Duration.ofMinutes(15),
                3,
                Duration.ofMinutes(1),
                false));
    }

    private static String base64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void data_URL_접두어가_붙어_있어도_벗겨서_읽는다() {
        String dataUrl = "data:image/png;base64," + base64(PNG);

        assertThat(codec(1024).decodeSketch(dataUrl)).isEqualTo(PNG);
    }

    @Test
    void 접두어_없는_순수_base64도_읽는다() {
        assertThat(codec(1024).decodeSketch(base64(PNG))).isEqualTo(PNG);
    }

    @Test
    void 줄바꿈이_섞여_있어도_읽는다() {
        String encoded = base64(PNG);
        String wrapped = encoded.substring(0, 4) + "\n" + encoded.substring(4);

        assertThat(codec(1024).decodeSketch(wrapped)).isEqualTo(PNG);
    }

    @Test
    void PNG_가_아니면_거절한다() {
        assertThatThrownBy(() -> codec(1024).decodeSketch(base64(NOT_PNG)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_SKETCH);
    }

    /** 🔴 base64 로는 멀쩡해 보여도 내용이 PNG 가 아니면 걸러야 한다 */
    @Test
    void 깨진_base64_는_PNG_머리를_못_만들어_거절된다() {
        assertThatThrownBy(() -> codec(1024).decodeSketch("!!!이건 base64 가 아닙니다!!!"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_SKETCH);
    }

    @Test
    void 빈_문자열은_거절한다() {
        assertThatThrownBy(() -> codec(1024).decodeSketch("   "))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_SKETCH);
    }

    @Test
    void null_은_거절한다() {
        assertThatThrownBy(() -> codec(1024).decodeSketch(null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_SKETCH);
    }

    @Test
    void 상한을_넘으면_크기_에러로_거절한다() {
        byte[] big = new byte[2048];
        System.arraycopy(PNG, 0, big, 0, PNG.length);

        assertThatThrownBy(() -> codec(64).decodeSketch(base64(big)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.SKETCH_TOO_LARGE);
    }

    /** 결과 이미지는 워커가 고칠 일이라 형식이든 크기든 한 코드로 답한다 */
    @Test
    void 결과_이미지는_결과용_에러코드로_거절한다() {
        assertThatThrownBy(() -> codec(1024).decodeResult(base64(NOT_PNG)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_RESULT_IMAGE);
    }

    @Test
    void 인코딩하면_그대로_다시_읽힌다() {
        StickerImageCodec codec = codec(1024);

        assertThat(codec.decodeSketch(codec.encode(PNG))).isEqualTo(PNG);
    }
}
