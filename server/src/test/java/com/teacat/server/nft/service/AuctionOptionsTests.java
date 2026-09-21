package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;

class AuctionOptionsTests {
    @ParameterizedTest
    @ValueSource(ints = {30, 60, 360, 10080})
    void acceptsMinuteBoundaries(int minutes) {
        assertThat(new NftAuctionCreateRequest(1000L, null, null, BigDecimal.valueOf(minutes)).resolveDuration())
                .isEqualTo(Duration.ofMinutes(minutes));
    }

    @ParameterizedTest
    @ValueSource(strings = {"29", "10081", "-30", "30.5", "999999999999999999999999999"})
    void rejectsInvalidMinutes(String minutes) {
        assertThatThrownBy(() -> new NftAuctionCreateRequest(1000L, null, null, new BigDecimal(minutes)).resolveDuration())
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void acceptsLegacyHoursButRejectsAmbiguousMissingAndFractionalHours() {
        assertThat(new NftAuctionCreateRequest(1000L, null, 24).resolveDuration()).isEqualTo(Duration.ofHours(24));
        assertThatThrownBy(() -> new NftAuctionCreateRequest(1000L, null, null, null).resolveDuration()).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> new NftAuctionCreateRequest(1000L, null, BigDecimal.ONE, BigDecimal.valueOf(60)).resolveDuration()).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> new NftAuctionCreateRequest(1000L, null, new BigDecimal("0.5"), null).resolveDuration()).isInstanceOf(BusinessException.class);
    }

    @Test
    void datesIncludeKoreanMidnightAndExcludeFollowingMidnight() {
        var range = BidDateRange.parse("2026-09-19", "2026-09-19");
        assertThat(range.from()).isEqualTo(LocalDateTime.of(2026, 9, 19, 0, 0));
        assertThat(range.toExclusive()).isEqualTo(LocalDateTime.of(2026, 9, 20, 0, 0));
        assertThat(BidDateRange.parse(null, null).from()).isNull();
        assertThat(BidDateRange.parse("2024-02-29", "2024-02-29").toExclusive()).isEqualTo(LocalDateTime.of(2024, 3, 1, 0, 0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "2026-02-30", "2026-9-01", "0000-01-01", "garbage"})
    void rejectsInvalidDates(String value) {
        assertThatThrownBy(() -> BidDateRange.parse(value, "2026-09-19")).isInstanceOf(BusinessException.class);
    }

    @Test
    void rejectsReversedIncompleteDatesAndCursorFromAnotherPeriod() {
        assertThatThrownBy(() -> BidDateRange.parse("2026-09-20", "2026-09-19")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> BidDateRange.parse(null, "2026-09-19")).isInstanceOf(BusinessException.class);
        var codec = new NftCursorCodec();
        String cursor = codec.encode(BidDateRange.parse("2026-09-19", "2026-09-19").cursorScope(), "5", 1L);
        assertThatThrownBy(() -> codec.decode(cursor, BidDateRange.parse("2026-09-18", "2026-09-19").cursorScope())).isInstanceOf(BusinessException.class);
    }
}
