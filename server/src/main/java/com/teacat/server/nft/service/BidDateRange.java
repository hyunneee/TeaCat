package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DateTimeException;

/** DB의 timestamp는 Asia/Seoul 현지 시각이다. 종료일의 다음날 00:00은 제외한다. */
record BidDateRange(LocalDateTime from, LocalDateTime toExclusive) {
    static BidDateRange parse(String from, String to) {
        if (from == null && to == null) return new BidDateRange(null, null);
        try {
            if (from == null || to == null || !from.matches("\\d{4}-\\d{2}-\\d{2}")
                    || !to.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
            LocalDate start = LocalDate.parse(from);
            LocalDate end = LocalDate.parse(to);
            if (start.getYear() < 1 || start.isAfter(end)) throw new IllegalArgumentException();
            return new BidDateRange(start.atStartOfDay(), end.plusDays(1).atStartOfDay());
        } catch (DateTimeException | IllegalArgumentException e) {
            throw new BusinessException(NftErrorCode.INVALID_BID_DATE_RANGE);
        }
    }

    String cursorScope() {
        return from == null ? "my-bids" : "my-bids:" + from.toLocalDate() + ":" + toExclusive.toLocalDate();
    }
}
