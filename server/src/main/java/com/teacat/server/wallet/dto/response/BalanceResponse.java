package com.teacat.server.wallet.dto.response;

import com.teacat.server.wallet.client.CatMoneyBalanceResult;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigInteger;

/**
 * 캣머니 잔액 응답.
 *
 * balance 는 체인에서 읽은 값 그대로다. 서버는 잔액을 저장하지 않는다
 * (blockchain/DESIGN.md 5-3 — 체인이 진실이고 캐시하면 반드시 어긋난다).
 * held 는 지금 쓸 수 없는 금액, available 은 balance − held 다.
 *
 * <b>held 에는 두 가지가 들어간다.</b> 경매 입찰처럼 쓰겠다고 묶어둔 돈(유효 홀드)과,
 * 이미 체인으로 보냈지만 확정을 기다리는 소각이다. 둘 다 체인 잔액에는 아직 남아 있지만
 * 임자가 정해진 돈이다 — 지출 판정({@code CatMoneyHoldService.availableBalance})이 똑같이
 * 빼므로, 여기서 하나라도 빠뜨리면 보이는 잔액과 쓸 수 있는 잔액이 어긋난다.
 *
 * <b>화면에서 "잔액" 자리에 넣는 값은 available 이다.</b> 5만을 가진 사용자가 4만을 입찰하면
 * 보이는 돈은 1만이어야 한다 — balance 를 보여주면 결제를 거절당할 때 이유를 알 수 없고,
 * 낙찰되어 실제로 돈이 나가는 순간 5만이 1만으로 뚝 떨어져 "돈이 사라졌다" 가 된다.
 */
@Schema(description = "캣머니 잔액")
public record BalanceResponse(

        @Schema(description = "체인 잔액. 캣머니는 소수가 없어 정수다", example = "50000")
        BigInteger balance,

        @Schema(description = "지금 쓸 수 없는 금액 (입찰 등으로 묶인 돈 + 확정을 기다리는 소각)",
                example = "40000")
        long held,

        @Schema(description = "지금 쓸 수 있는 금액 (balance − held). 화면의 잔액은 이 값이다", example = "10000")
        long available,

        @Schema(description = "표기 단위", example = "CAT")
        String symbol
) {

    public static BalanceResponse of(CatMoneyBalanceResult result, long held) {
        BigInteger balance = new BigInteger(result.balance());
        // 정상 흐름에서는 음수가 안 된다(홀드는 가용 잔액 검사를 통과한 뒤에만 만들어진다).
        // 지갑에서 직접 코인을 빼는 등 판정 창구를 안 타는 지출이 있으면 어긋날 수 있어 0 으로 자른다.
        long available = Math.max(0L, balance.longValueExact() - held);
        return new BalanceResponse(balance, held, available, result.symbol());
    }
}
