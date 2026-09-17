package com.teacat.server.nft.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class NftChainIdentityMigrationTests {

    @Test
    void 기존_체인_식별자는_보존하고_미제출_행만_새_식별자를_받는다() {
        try (PostgreSQLContainer postgres = new PostgreSQLContainer("pgvector/pgvector:pg18")
                .withDatabaseName("teacat_migration_test")
                .withUsername("teacat")
                .withPassword("teacat_test_pw")
                .withStartupTimeout(Duration.ofMinutes(2))) {
            postgres.start();

            var dataSource = new DriverManagerDataSource(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
            Flyway.configure()
                    .dataSource(dataSource)
                    .target(MigrationVersion.fromVersion("20260916.1110"))
                    .load()
                    .migrate();

            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            Long userId = jdbc.queryForObject("""
                    INSERT INTO users (email, password, name, nickname, phone, role)
                    VALUES ('identity@test.com', 'encoded', '테스트', '식별자', '010-0000-0000', 'USER')
                    RETURNING id
                    """, Long.class);
            Long legacyDesignId = insertDesign(jdbc, "REGISTERED", "0x" + "1".repeat(64));
            Long pendingDesignId = insertDesign(jdbc, "PENDING", null);
            Long mintedCardId = insertCard(jdbc, legacyDesignId, userId, "MINTED", "0x" + "2".repeat(64));
            Long pendingCardId = insertCard(jdbc, pendingDesignId, userId, "PENDING", null);

            Flyway.configure().dataSource(dataSource).load().migrate();

            assertThat(jdbc.queryForObject(
                    "SELECT issue_key FROM nft_photocards WHERE id = ?", String.class, mintedCardId))
                    .isEqualTo(mintedCardId.toString());
            assertThat(jdbc.queryForObject(
                    "SELECT issue_key FROM nft_photocards WHERE id = ?", String.class, pendingCardId))
                    .matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
                    .isNotEqualTo(pendingCardId.toString());
            assertThat(jdbc.queryForObject(
                    "SELECT chain_token_id::text FROM nft_photocard_designs WHERE id = ?",
                    String.class, legacyDesignId)).isEqualTo(legacyDesignId.toString());
            assertThat(jdbc.queryForObject(
                    "SELECT chain_token_id FROM nft_photocard_designs WHERE id = ?",
                    String.class, pendingDesignId)).isNull();
        }
    }

    private Long insertDesign(JdbcTemplate jdbc, String chainStatus, String registerTxHash) {
        return jdbc.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (name, image_url, total_supply, draw_pool, group_name, grade,
                     chain_status, register_tx_hash)
                VALUES (?, '/identity.png', 10, true, 'TeaCat', 'COMMON',
                        ?::nft_design_chain_status, ?)
                RETURNING id
                """, Long.class, "도안-" + chainStatus, chainStatus, registerTxHash);
    }

    private Long insertCard(JdbcTemplate jdbc, Long designId, Long ownerId,
                            String status, String mintTxHash) {
        return jdbc.queryForObject("""
                INSERT INTO nft_photocards (design_id, owner_id, status, mint_tx_hash)
                VALUES (?, ?, ?::nft_mint_status, ?)
                RETURNING id
                """, Long.class, designId, ownerId, status, mintTxHash);
    }
}
