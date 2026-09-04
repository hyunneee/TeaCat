package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
class NftCursorCodec {

    String encode(String scope, String value, Long id) {
        String raw = scope + '|' + value + '|' + id;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    Cursor decode(String encoded, String expectedScope) {
        if (encoded == null || encoded.isBlank()) {
            return Cursor.empty();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", 3);
            if (parts.length != 3 || !parts[0].equals(expectedScope)) {
                throw new IllegalArgumentException();
            }
            return new Cursor(parts[1], Long.parseLong(parts[2]));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(NftErrorCode.INVALID_CURSOR);
        }
    }

    record Cursor(String value, Long id) {

        static Cursor empty() {
            return new Cursor(null, null);
        }

        boolean present() {
            return value != null;
        }
    }
}

