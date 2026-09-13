package com.teacat.server.performance.service;

import com.teacat.server.booking.repository.PerformanceSeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 티켓 오픈 시각이 지난 회차의 예매 좌석을 멱등하게 생성한다. */
@Service
@RequiredArgsConstructor
public class SeatGenerationService {

    private final PerformanceSeatRepository performanceSeatRepository;

    @Transactional
    public int generateForOpenedSchedules() {
        return performanceSeatRepository.insertMissingForOpenedSchedules();
    }
}
