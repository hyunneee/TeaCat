package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.performance.dto.response.ConcertStatusResponse;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * 공연 상태 전환 (API-264) 과 등록자 확인.
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceStatusTests {

    private static final Long OWNER_ID = 6L;
    /** 공연 주최자 — 자기가 등록한 공연만 다룰 수 있다 */
    private static final AuthUser OWNER = new AuthUser(OWNER_ID, UserRole.PERFORMANCE);
    /** 다른 주최자 — 남의 공연은 못 다룬다 */
    private static final AuthUser OTHER_ORGANIZER = new AuthUser(7L, UserRole.PERFORMANCE);
    /** 전체 관리자 — 남이 등록한 공연도 다룰 수 있다 */
    private static final AuthUser ADMIN = new AuthUser(8L, UserRole.ADMIN);

    @Mock
    private PerformanceGeneralRepository performanceGeneralRepository;

    @InjectMocks
    private AdminPerformanceService service;

    private PerformanceGeneral performance;

    @BeforeEach
    void setUp() {
        performance = PerformanceGeneral.create(
                null, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER_ID);
    }

    private void givenPerformanceExists() {
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
    }

    @Test
    void 예정에서_진행중으로_바꾸고_이전_상태를_함께_돌려준다() {
        givenPerformanceExists();

        ConcertStatusResponse response = service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ONGOING);
        assertThat(response.previousStatus()).isEqualTo(PerformanceStatus.UPCOMING);
        assertThat(response.status()).isEqualTo(PerformanceStatus.ONGOING);
    }

    @Test
    void 허용되지_않는_전이는_거절하고_상태를_바꾸지_않는다() {
        givenPerformanceExists();

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ENDED, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.INVALID_STATUS_TRANSITION);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.UPCOMING);
    }

    @Test
    void 종료된_공연은_되돌릴_수_없다() {
        givenPerformanceExists();

        service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER);
        service.changeStatus(1L, PerformanceStatus.ENDED, OWNER);

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER))
                .isInstanceOf(BusinessException.class);
        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ENDED);
    }

    @Test
    void 없는_공연이면_404_에러코드() {
        given(performanceGeneralRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeStatus(99L, PerformanceStatus.ONGOING, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
    }

    @Test
    void 다른_관리자가_등록한_공연은_403으로_거절하고_상태를_바꾸지_않는다() {
        givenPerformanceExists();

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ONGOING, OTHER_ORGANIZER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.UPCOMING);
    }

    @Test
    void 등록자를_알_수_없는_공연은_주최자가_관리할_수_없다() {
        given(performanceGeneralRepository.findById(2L)).willReturn(Optional.of(legacyPerformance()));

        assertThatThrownBy(() -> service.delete(2L, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);
    }

    @Test
    void 전체_관리자는_남이_등록한_공연의_상태를_바꿀_수_있다() {
        givenPerformanceExists();

        service.changeStatus(1L, PerformanceStatus.ONGOING, ADMIN);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ONGOING);
    }

    @Test
    void 전체_관리자는_남이_등록한_공연을_삭제할_수_있다() {
        givenPerformanceExists();
        given(performanceGeneralRepository.existsTicketByPerformanceId(1L)).willReturn(false);

        service.delete(1L, ADMIN);

        verify(performanceGeneralRepository).delete(performance);
    }

    @Test
    void 전체_관리자는_등록자를_알_수_없는_옛_공연도_관리할_수_있다() {
        PerformanceGeneral legacy = legacyPerformance();
        given(performanceGeneralRepository.findById(2L)).willReturn(Optional.of(legacy));
        given(performanceGeneralRepository.existsTicketByPerformanceId(2L)).willReturn(false);

        // 등록자가 null 인 옛 데이터는 주최자 누구도 손댈 수 없어 방치됐다. ADMIN 이 정리할 수 있어야 한다
        service.delete(2L, ADMIN);

        verify(performanceGeneralRepository).delete(legacy);
    }

    private PerformanceGeneral legacyPerformance() {
        return PerformanceGeneral.create(
                null, "옛 공연", LocalDateTime.of(2026, 10, 1, 20, 0), LocalDate.of(2026, 9, 1), null, null, null);
    }
}
