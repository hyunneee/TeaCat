package com.teacat.server.support;

import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.client.CatMoneyBalanceResult;
import com.teacat.server.wallet.client.CatMoneyClient;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Duration;

import static org.mockito.BDDMockito.given;

/**
 * PostgreSQL 컨테이너 위에서 도는 통합 테스트의 공통 기반.
 *
 * 체인은 붙이지 않는다 — {@link CatMoneyClient} 를 스텁으로 바꿔 잔액을 주입한다.
 * 스위퍼는 꺼 둔다. 마감은 테스트가 직접 {@code close} 를 불러 검증한다.
 *
 * <p>컨테이너는 {@code @Container} 가 아니라 <b>static 초기화로 한 번만</b> 띄운다(싱글턴 컨테이너).
 * 이 클래스를 상속하는 테스트 클래스들은 설정이 같아 Spring 컨텍스트를 공유하는데, {@code @Container} 는
 * 첫 클래스가 끝나면 컨테이너를 내려 버린다 — 캐시된 컨텍스트의 DataSource 가 죽은 포트를 가리키게 되고
 * 다음 클래스는 전부 {@code Failed to obtain JDBC Connection} 으로 실패한다. 정리는 Ryuk 가 JVM 종료 후 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class PostgresIntegrationTest {

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("pgvector/pgvector:pg18")
            .withDatabaseName("teacat_test")
            .withUsername("teacat")
            .withPassword("teacat_test_pw")
            /*
             * 🔴 커넥션 한도를 올린다. 기본값 100 으로는 전체 테스트가 중간에 무너진다 —
             *    `FATAL: sorry, too many clients already` 로 무관한 테스트가 무더기로 깨진다.
             *
             * 왜 부족하냐면, 스프링은 **목(@MockitoBean) 구성이 다르면 컨텍스트를 새로 만들고**
             * 만든 뒤에는 테스트가 끝날 때까지 캐시에 두기 때문이다. 컨텍스트마다 Hikari 가
             * 기본 10개를 쥐고 안 놓는다. 지금 목을 쓰는 테스트 클래스가 18개가 넘어
             * 18 × 10 = 180 > 100 이다.
             *
             * ⚠️ **테스트가 늘어날수록 다시 부딪힌다.** 근본 해결은 목 구성을 맞춰 컨텍스트 수를
             *    줄이는 것이지만, 그건 테스트 18개를 손봐야 하는 일이라 따로 다룬다.
             *
             * ⚠️ 풀 크기를 줄이는 방법(`maximum-pool-size`)도 있으나 쓰지 않았다. 한 테스트가
             *    동시에 여러 연결을 쓰면 **실패가 아니라 멈춘다** — 타임아웃까지 가서 원인을 찾기
             *    어렵다. 여기서는 상한만 올려 동작을 바꾸지 않는 쪽을 택했다.
             *
             * 임시 컨테이너라 운영과 무관하고, 상한만 올리는 것이라 실제로 안 쓰면 메모리도 안 든다.
             */
            .withCommand("postgres", "-c", "max_connections=300")
            .withStartupTimeout(Duration.ofMinutes(2));

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("nft.auction.sweep-enabled", () -> "false");
        // 도안 등록 확정 감시도 끈다. 확정은 테스트가 직접 confirm 을 불러 검증한다
        registry.add("nft.design.confirm-enabled", () -> "false");
        // 회차 자동 발급 스케줄러도 끈다. 발급은 테스트가 직접 불러 검증한다
        registry.add("nft.photocard.issue.scheduler-enabled", () -> "false");
        // 뽑기 카드 재전송 스위퍼도 끈다. 전송은 테스트가 직접 검증한다
        registry.add("nft.photocard.draw.sweep-enabled", () -> "false");
        // 이상거래 심사의 시한 자동 승인·기록 정리 스위퍼도 끈다. 승인·거절은 테스트가 직접 부른다
        registry.add("nft.trade.review.maintenance-enabled", () -> "false");
        // 지갑 발급 스위퍼도 끈다. 테스트에는 브로커가 없다 — 리스너도 붙이지 않는다
        registry.add("wallet.provisioning.sweep-enabled", () -> "false");
        // 스티커 작업 정리도 끈다. 정리는 테스트가 직접 sweep 을 불러 검증한다
        registry.add("sticker.sweep-enabled", () -> "false");
        registry.add("spring.rabbitmq.listener.simple.auto-startup", () -> "false");
    }

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected BlockchainProperties blockchainProperties;

    @MockitoBean
    protected CatMoneyClient catMoneyClient;

    @BeforeEach
    void cleanDatabase() {
        // nft_photocard_designs: 뽑기 풀 도안은 공연이 없어 stadiums 의 CASCADE 로 지워지지 않는다
        // nft_photocard_pack_events: users 의 CASCADE 로 지워지지 않는다 (외래키가 없다)
        jdbcTemplate.execute(
                "TRUNCATE TABLE users, faces, stadiums, nft_photocard_designs, "
                        + "nft_photocard_pack_events, nft_photocard_templates RESTART IDENTITY CASCADE");
    }

    protected Long insertUser(String email, String nickname) {
        return insertUser(email, nickname, "USER");
    }

    protected Long insertUser(String email, String nickname, String role) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role)
                VALUES (?, 'encoded-password', '테스트 사용자', ?, '010-0000-0000', ?::user_role)
                RETURNING id
                """, Long.class, email, nickname, role);
    }

    protected Long insertFace() {
        String zeros = "[" + "0,".repeat(127) + "0]";
        return jdbcTemplate.queryForObject("""
                INSERT INTO faces (embedding, model_version) VALUES (?::vector, 'test') RETURNING id
                """, Long.class, zeros);
    }

    /** 유저에게 지갑을 만들어 준다. 주소는 유저 id 로 결정되므로 {@link #addressOf} 로 되찾을 수 있다 */
    protected String insertWallet(Long userId) {
        String address = addressOf(userId);
        Long ownerId = jdbcTemplate.queryForObject("""
                INSERT INTO wallet_owners (user_id, derivation_index, owner_address, key_version)
                VALUES (?, ?, ?, 1) RETURNING id
                """, Long.class, userId, userId.intValue(), address);
        jdbcTemplate.update("""
                INSERT INTO wallets (owner_id, chain_id, type, address, status)
                VALUES (?, ?, 'RELAYER_EOA', ?, 'ACTIVE')
                """, ownerId, blockchainProperties.chainId(), address);
        return address;
    }

    protected String addressOf(Long userId) {
        return "0x" + String.format("%040x", userId);
    }

    protected void givenChainBalance(Long userId, long balance) {
        given(catMoneyClient.getBalance(addressOf(userId)))
                .willReturn(new CatMoneyBalanceResult(addressOf(userId), String.valueOf(balance), 0, "CAT"));
    }

    /** 지갑 + 체인 잔액까지 갖춘 유저 */
    protected Long insertFundedUser(String email, String nickname, long balance) {
        Long userId = insertUser(email, nickname);
        insertWallet(userId);
        givenChainBalance(userId, balance);
        return userId;
    }

    protected Fixture insertPerformanceFixture() {
        Long stadiumId = jdbcTemplate.queryForObject("""
                INSERT INTO stadiums (name, address, max_capacity)
                VALUES ('테스트 공연장', '서울', 100000) RETURNING id
                """, Long.class);
        Long layoutId = jdbcTemplate.queryForObject("""
                INSERT INTO stadium_layouts
                    (stadium_id, name, width, height, is_default, status)
                VALUES (?, '기본 배치', 1000, 1000, true, 'ACTIVE') RETURNING id
                """, Long.class, stadiumId);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, stadium_layout_id, area_code, type, max_seat)
                VALUES (?, ?, 'A', 'SEATED', 1000) RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, stadium_layout_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, ?, CURRENT_DATE, '테스트 공연', now(), 'UPCOMING') RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceDetailId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_details
                    (performance_general_id, performance_num, performance_date, status)
                VALUES (?, 1, CURRENT_DATE, 'SCHEDULED') RETURNING id
                """, Long.class, performanceId);
        jdbcTemplate.update("""
                INSERT INTO performance_areas
                    (performance_general_id, area_id, grade, price, max_cnt)
                VALUES (?, ?, 'VIP', 100000, 1000)
                """, performanceId, areaId);
        return new Fixture(performanceId, performanceDetailId, areaId);
    }

    protected Long insertTicket(Long userId, Fixture fixture) {
        Integer seatNumber = jdbcTemplate.queryForObject(
                "SELECT count(*)::int + 1 FROM seats WHERE area_id = ?", Integer.class, fixture.areaId());
        Long seatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number)
                VALUES (?, '3', ?) RETURNING id
                """, Long.class, fixture.areaId(), seatNumber);
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_embedding, face_model_version)
                VALUES (?, ?, ?, ?, 'CONFIRMED', (SELECT embedding FROM faces WHERE id = ?), 'test-model') RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), seatId, insertFace());
    }

    protected Long insertDesign(Long performanceId, String name, int totalSupply) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply)
                VALUES (?, ?, '/test.png', ?) RETURNING id
                """, Long.class, performanceId, name, totalSupply);
    }

    /** 체인 등록까지 끝난 뽑기 풀 도안. 뽑기 후보 조건(draw_pool · REGISTERED)을 그대로 만족한다 */
    protected Long insertDrawPoolDesign(String name, int totalSupply, String groupName, String grade) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply, image_cid, metadata_cid,
                     chain_status, draw_pool, group_name, grade)
                VALUES (NULL, ?, '/draw.png', ?, 'bafyIMG', 'bafyMETA',
                        'REGISTERED', true, ?, ?::nft_photocard_grade) RETURNING id
                """, Long.class, name, totalSupply, groupName, grade);
    }

    /** 안 쓴 이벤트 팩 하나 */
    protected Long insertPack(Long userId, String sourceRef) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_packs (user_id, source, source_ref)
                VALUES (?, 'EVENT', ?) RETURNING id
                """, Long.class, userId, sourceRef);
    }

    protected Long insertPhotocard(Long designId, Long ticketId, Long ownerId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'PENDING') RETURNING id
                """, Long.class, designId, ticketId, ownerId);
    }

    protected Long insertPhotocardOwnedBy(Long ownerId) {
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(ownerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        return insertPhotocard(designId, ticketId, ownerId);
    }

    /**
     * 경매 행을 직접 넣는다. 서비스 규칙을 우회하므로 마감·조회 테스트처럼 "이미 있는 경매" 가 필요할 때만 쓴다.
     *
     * @param endsAtSql SQL 식. 예: {@code "now() + interval '1 day'"}, {@code "now() - interval '1 minute'"}
     */
    protected Long insertAuction(Long photocardId, Long sellerId, long startPrice, Long buyNowPrice,
                                 String endsAtSql) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_auctions
                    (photocard_id, seller_id, start_price, buy_now_price, current_price, ends_at)
                VALUES (?, ?, ?, ?, ?, %s) RETURNING id
                """.formatted(endsAtSql), Long.class, photocardId, sellerId, startPrice, buyNowPrice, startPrice);
    }

    protected record Fixture(Long performanceId, Long performanceDetailId, Long areaId) {
    }
}
