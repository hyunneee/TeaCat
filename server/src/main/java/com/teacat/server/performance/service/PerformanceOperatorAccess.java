package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.user.entity.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 운영 API에서 외부 부수 효과나 개인정보 조회 전에 담당 공연을 검사한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceOperatorAccess {
    private final PerformanceGeneralRepository performances;
    private final PerformanceDetailRepository schedules;
    private final NftPhotocardDesignRepository designs;

    public void performance(AuthUser actor, Long id) {
        if (actor == null || (!actor.isAdmin() && actor.role() != UserRole.PERFORMANCE)) deny();
        if (id == null) {
            if (!actor.isAdmin()) deny();
            return;
        }
        var performance = performances.findById(id)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
        if (!actor.isAdmin() && !performance.isOwnedBy(actor.id())) deny();
    }

    public void schedule(AuthUser actor, Long id) {
        var schedule = schedules.findById(id)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
        performance(actor, schedule.getPerformance().getId());
    }

    public void design(AuthUser actor, Long id) {
        var design = designs.findById(id)
                .orElseThrow(() -> new BusinessException(NftErrorCode.DESIGN_NOT_FOUND));
        performance(actor, design.getPerformanceId());
    }

    private void deny() { throw new BusinessException(PerformanceErrorCode.NOT_OWNER); }
}
