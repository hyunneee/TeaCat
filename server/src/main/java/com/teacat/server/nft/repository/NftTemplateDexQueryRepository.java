package com.teacat.server.nft.repository;

import com.teacat.server.nft.dto.response.MyNftPhotocardSummaryResponse.MarketState;
import com.teacat.server.nft.dto.response.NftPocaDexResponse.Acquisition;
import com.teacat.server.nft.dto.response.NftPocaDexResponse.AcquisitionType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class NftTemplateDexQueryRepository {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<OwnedRow> findOwned(Long userId) {
        // EXISTS로 판매 여부를 확인해 조인으로 한 카드가 여러 번 집계되는 것을 방지한다.
        return jdbcTemplate.query("""
                SELECT p.id, d.template_id, p.status,
                       CASE WHEN EXISTS (SELECT 1 FROM nft_photocard_listings l
                                         WHERE l.photocard_id = p.id AND l.status = 'SETTLING')
                                  OR EXISTS (SELECT 1 FROM nft_auctions a
                                             WHERE a.photocard_id = p.id AND a.status = 'SETTLING')
                            THEN 'SETTLING'
                            WHEN EXISTS (SELECT 1 FROM nft_auctions a
                                         WHERE a.photocard_id = p.id AND a.status = 'ACTIVE')
                            THEN 'AUCTION'
                            WHEN EXISTS (SELECT 1 FROM nft_photocard_listings l
                                         WHERE l.photocard_id = p.id AND l.status = 'ACTIVE')
                            THEN 'LISTED' END AS market_state
                  FROM nft_photocards p
                  JOIN nft_photocard_designs d ON d.id = p.design_id
                  JOIN nft_photocard_templates t ON t.id = d.template_id AND NOT t.hidden
                 WHERE p.owner_id = :userId
                 ORDER BY p.created_at DESC, p.id DESC
                """, new MapSqlParameterSource("userId", userId), (rs, n) -> new OwnedRow(
                rs.getLong("id"), rs.getLong("template_id"), "PENDING".equals(rs.getString("status")),
                rs.getString("market_state") == null ? null : MarketState.valueOf(rs.getString("market_state"))));
    }

    public List<SourceRow> findSources() {
        return jdbcTemplate.query("""
                SELECT DISTINCT d.template_id, d.performance_general_id, pg.title
                  FROM nft_photocard_designs d
                  JOIN nft_photocard_templates t ON t.id = d.template_id AND NOT t.hidden
                  LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
                 WHERE d.draw_pool AND d.chain_status = 'REGISTERED'
                   AND (d.performance_general_id IS NULL
                        OR (pg.hidden_at IS NULL AND pg.visible_from <= CURRENT_DATE))
                 ORDER BY d.template_id, d.performance_general_id NULLS LAST
                """, new MapSqlParameterSource(), (rs, n) -> new SourceRow(
                rs.getLong("template_id"), rs.getObject("performance_general_id") == null
                ? new Acquisition(AcquisitionType.EVENT, "이벤트 포토카드 팩")
                : new Acquisition(AcquisitionType.PERFORMANCE, rs.getString("title"))));
    }

    public record OwnedRow(Long photocardId, Long templateId, boolean pending, MarketState marketState) {}
    public record SourceRow(Long templateId, Acquisition acquisition) {}
}
