package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class NftPocaDexQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    /**
     * Returns designs that should occupy a slot in this user's collection.
     *
     * <p>Public performance and event-pool designs are shown as slots. Designs already owned by
     * the user remain in the collection even after their performance becomes hidden.
     */
    public List<DesignRow> findDesigns(Long userId) {
        String sql = """
                SELECT d.id AS design_id, d.name, d.image_url, d.group_name,
                       d.grade::text AS grade, d.performance_general_id,
                       pg.title AS performance_title
                  FROM nft_photocard_designs d
                  LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
                 WHERE EXISTS (SELECT 1
                                 FROM nft_photocards mine
                                WHERE mine.design_id = d.id AND mine.owner_id = :userId)
                    OR (d.chain_status = 'REGISTERED'
                        AND ((d.draw_pool AND d.performance_general_id IS NULL)
                             OR (d.performance_general_id IS NOT NULL
                                 AND pg.hidden_at IS NULL
                                 AND pg.visible_from <= CURRENT_DATE)))
                 ORDER BY d.id
                """;
        return jdbcTemplate.query(sql, new MapSqlParameterSource("userId", userId),
                (rs, rowNum) -> new DesignRow(
                        rs.getLong("design_id"),
                        rs.getString("name"),
                        rs.getString("image_url"),
                        rs.getString("group_name"),
                        rs.getString("grade") == null
                                ? null : NftPhotocardGrade.valueOf(rs.getString("grade")),
                        rs.getObject("performance_general_id", Long.class),
                        rs.getString("performance_title")));
    }

    public record DesignRow(Long designId, String name, String imageUrl, String groupName,
                            NftPhotocardGrade grade, Long performanceId, String performanceTitle) {
    }
}
