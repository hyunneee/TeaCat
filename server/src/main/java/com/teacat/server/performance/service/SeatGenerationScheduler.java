package com.teacat.server.performance.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 예매 오픈 직후 좌석이 자동으로 노출되도록 주기적으로 누락분을 채운다. */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "booking.seat-generation", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SeatGenerationScheduler {

    private final SeatGenerationService seatGenerationService;

    @Scheduled(
            fixedDelayString = "${booking.seat-generation.interval:PT10S}",
            initialDelayString = "${booking.seat-generation.initial-delay:PT3S}")
    public void generateOpenedScheduleSeats() {
        int created = seatGenerationService.generateForOpenedSchedules();
        if (created > 0) {
            log.info("예매 오픈 회차 좌석 자동 생성 완료: {}석", created);
        }
    }
}
