package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.Duration;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;

public record NftAuctionCreateRequest(

        @Schema(description = "시작가(CAT)", example = "1000", minimum = "1")
        @NotNull(message = "시작가를 입력해 주세요.")
        @Positive(message = "시작가를 1 이상으로 입력해 주세요.")
        Long startPrice,

        @Schema(description = "즉시구매가(CAT). 없으면 생략. 시작가보다 높아야 한다", example = "5000", nullable = true)
        @Positive(message = "즉시구매가를 1 이상으로 입력해 주세요.")
        Long buyNowPrice,

        @Schema(description = "이전 클라이언트용 정수 시간. durationMinutes와 둘 중 하나만 전송", type = "integer", deprecated = true)
        BigDecimal durationHours,
        @Schema(description = "진행 시간(정수 분). 30~10080분", type = "integer", example = "60", minimum = "30", maximum = "10080")
        BigDecimal durationMinutes
) {
    public NftAuctionCreateRequest(Long startPrice, Long buyNowPrice, Integer durationHours) {
        this(startPrice, buyNowPrice, durationHours == null ? null : BigDecimal.valueOf(durationHours), null);
    }

    public Duration resolveDuration() {
        // Integer 역직렬화의 소수 절삭을 피하고 정확히 정수인 값만 받는다.
        if ((durationHours == null) == (durationMinutes == null)) {
            throw new BusinessException(NftErrorCode.INVALID_AUCTION_DURATION);
        }
        try {
            long minutes = durationMinutes != null ? durationMinutes.longValueExact()
                    : Math.multiplyExact(durationHours.longValueExact(), 60);
            if (minutes < 30 || minutes > 10080) {
                throw new ArithmeticException();
            }
            return Duration.ofMinutes(minutes);
        } catch (ArithmeticException e) {
            throw new BusinessException(NftErrorCode.INVALID_AUCTION_DURATION);
        }
    }
}
