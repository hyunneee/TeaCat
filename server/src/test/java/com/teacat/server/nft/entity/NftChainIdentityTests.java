package com.teacat.server.nft.entity;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.HashSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class NftChainIdentityTests {

    @Test
    void 신규_발행_키는_서로_다른_UUID다() {
        var keys = new HashSet<String>();
        for (int i = 0; i < 1_000; i++) {
            String key = NftChainIdentity.newIssueKey();
            assertThat(UUID.fromString(key).toString()).isEqualTo(key);
            keys.add(key);
        }
        assertThat(keys).hasSize(1_000);
    }

    @Test
    void 신규_체인_토큰은_양수이고_uint256_범위_안에서_고유하다() {
        BigInteger uint256Max = BigInteger.ONE.shiftLeft(256).subtract(BigInteger.ONE);
        var tokens = new HashSet<String>();
        for (int i = 0; i < 1_000; i++) {
            var token = NftChainIdentity.newChainTokenId();
            assertThat(token.scale()).isZero();
            assertThat(token.toBigIntegerExact()).isPositive().isLessThanOrEqualTo(uint256Max);
            tokens.add(token.toPlainString());
        }
        assertThat(tokens).hasSize(1_000);
    }
}
