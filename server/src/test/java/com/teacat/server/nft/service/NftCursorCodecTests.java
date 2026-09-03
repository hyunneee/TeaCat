package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NftCursorCodecTests {

    private final NftCursorCodec codec = new NftCursorCodec();

    @Test
    void 커서를_인코딩하고_복원한다() {
        String encoded = codec.encode("market:RECENT", "2026-09-03T13:00:00", 10L);

        NftCursorCodec.Cursor cursor = codec.decode(encoded, "market:RECENT");

        assertThat(cursor.value()).isEqualTo("2026-09-03T13:00:00");
        assertThat(cursor.id()).isEqualTo(10L);
    }

    @Test
    void 다른_조회조건의_커서는_거부한다() {
        String encoded = codec.encode("market:RECENT", "2026-09-03T13:00:00", 10L);

        assertThatThrownBy(() -> codec.decode(encoded, "market:PRICE_ASC"))
                .isInstanceOf(BusinessException.class);
    }
}
