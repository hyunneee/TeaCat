package com.teacat.server.nft.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NftErrorCodeTests {
    @Test
    void errorCodesAreUnique() {
        assertThat(NftErrorCode.values())
                .extracting(NftErrorCode::getCode)
                .doesNotHaveDuplicates();
    }
}
