package com.teacat.server.nft.entity;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.UUID;

/** 관계형 PK와 독립적인 신규 온체인 식별자를 만든다. */
public final class NftChainIdentity {

    private NftChainIdentity() {
    }

    public static String newIssueKey() {
        return UUID.randomUUID().toString();
    }

    /** UUID의 128비트를 부호 없는 양의 uint256 값으로 사용한다. */
    public static BigDecimal newChainTokenId() {
        UUID value = UUID.randomUUID();
        String hexadecimal = value.toString().replace("-", "");
        return new BigDecimal(new BigInteger(hexadecimal, 16));
    }
}
