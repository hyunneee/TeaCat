package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PerformanceOperatorAccessTests {
    @Test void ownerOnlyAndAdmin() {
        var performances = mock(PerformanceGeneralRepository.class);
        var performance = mock(PerformanceGeneral.class);
        when(performances.findById(10L)).thenReturn(Optional.of(performance));
        when(performance.isOwnedBy(1L)).thenReturn(true);
        var access = new PerformanceOperatorAccess(performances, mock(PerformanceDetailRepository.class), mock(NftPhotocardDesignRepository.class));
        access.performance(new AuthUser(1L, UserRole.PERFORMANCE), 10L);
        access.performance(new AuthUser(2L, UserRole.ADMIN), 10L);
        assertThatThrownBy(() -> access.performance(new AuthUser(2L, UserRole.PERFORMANCE), 10L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> access.performance(new AuthUser(1L, UserRole.STADIUM), 10L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> access.performance(new AuthUser(1L, UserRole.USER), 10L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> access.performance(new AuthUser(1L, UserRole.PERFORMANCE), null)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> access.performance(null, 10L)).isInstanceOf(BusinessException.class);
    }
}
