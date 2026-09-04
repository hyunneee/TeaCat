package com.teacat.server.wallet.dto.response;

import com.teacat.server.wallet.client.CatMoneyBalanceResult;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigInteger;

/**
 * 캣머니 잔액 응답.
 *
 * 체인에서 읽은 값을 그대로 내려준다. 서버는 잔액을 저장하지 않는다
 * (blockchain/DESIGN.md 5-3 — 체인이 진실이고 캐시하면 반드시 어긋난다).
 */
@Schema(description = "캣머니 잔액")
public record BalanceResponse(

        @Schema(description = "잔액. 캣머니는 소수가 없어 정수다", example = "1500")
        BigInteger balance,

        @Schema(description = "표기 단위", example = "CAT")
        String symbol
) {

    public static BalanceResponse from(CatMoneyBalanceResult result) {
        return new BalanceResponse(new BigInteger(result.balance()), result.symbol());
    }
}
