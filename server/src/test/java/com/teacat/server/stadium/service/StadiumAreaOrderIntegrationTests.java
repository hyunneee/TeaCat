package com.teacat.server.stadium.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.stadium.dto.request.LayoutBoundsRequest;
import com.teacat.server.stadium.dto.request.LayoutImportAreaRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCopyRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCreateRequest;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.StadiumLayoutSaveMode;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StadiumAreaOrderIntegrationTests extends PostgresIntegrationTest {
    @Autowired private StadiumLayoutService layouts;
    @Autowired private AreaRepository areas;

    @Test
    void submittedOrderSurvivesDatabaseReadAndCopy() {
        Long stadiumId = jdbcTemplate.queryForObject("""
                INSERT INTO stadiums (name, address, max_capacity)
                VALUES ('Order venue', 'Seoul', 1000) RETURNING id
                """, Long.class);
        var actor = new AuthUser(1L, UserRole.ADMIN);
        var ordered = List.of("front", "middle", "back").stream()
                .map(code -> new LayoutImportAreaRequest(code, "1F", "1F", AreaType.STANDING, 10,
                        new LayoutBoundsRequest(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.TEN),
                        List.of(), List.of(), null)).toList();
        var created = layouts.createFromExcel(stadiumId, actor, new StadiumLayoutCreateRequest(
                null, "Ordered", true, StadiumLayoutSaveMode.PUBLISH, "1F", 100, 100, ordered, List.of()));

        assertThat(areas.findAllWithStatsByLayoutId(created.layoutId()))
                .extracting(AreaRepository.AreaStats::getAreaCode).containsExactly("front", "middle", "back");
        assertThat(areas.findAllWithStatsByStadiumId(stadiumId))
                .extracting(AreaRepository.AreaStats::getAreaCode).containsExactly("front", "middle", "back");
        assertThat(areas.findAllWithStatsByLayoutId(created.layoutId()))
                .extracting(AreaRepository.AreaStats::getAreaId).isSorted();

        var copied = layouts.copyLayout(created.layoutId(), actor,
                new StadiumLayoutCopyRequest("Copied", false, StadiumLayoutSaveMode.DRAFT));
        assertThat(areas.findAllWithStatsByLayoutId(copied.layoutId()))
                .extracting(AreaRepository.AreaStats::getAreaCode).containsExactly("front", "middle", "back");
        assertThat(jdbcTemplate.queryForList(
                "SELECT display_order FROM areas WHERE stadium_layout_id = ? ORDER BY display_order", Integer.class,
                copied.layoutId())).containsExactly(0, 1, 2);
    }
}
