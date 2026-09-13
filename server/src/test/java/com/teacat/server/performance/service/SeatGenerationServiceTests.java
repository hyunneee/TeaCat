package com.teacat.server.performance.service;

import com.teacat.server.booking.repository.PerformanceSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SeatGenerationServiceTests {

    @Mock
    private PerformanceSeatRepository performanceSeatRepository;

    @InjectMocks
    private SeatGenerationService service;

    @Test
    void 오픈된_회차의_누락_좌석_생성을_저장소에_위임한다() {
        given(performanceSeatRepository.insertMissingForOpenedSchedules()).willReturn(37);

        assertThat(service.generateForOpenedSchedules()).isEqualTo(37);
        verify(performanceSeatRepository).insertMissingForOpenedSchedules();
    }
}
