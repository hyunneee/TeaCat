package com.teacat.server.wallet.service;

import com.teacat.server.common.config.RabbitConfig;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.wallet.client.BlockchainWalletClient;
import com.teacat.server.wallet.client.WalletCreationResponse;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.messaging.WalletProvisionMessage;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigInteger;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 가입 → 발급 요청 행 → (큐) → 지갑.
 *
 * <p>브로커는 붙이지 않는다. {@link RabbitTemplate} 을 스텁으로 바꿔 "커밋 뒤 메시지가 나갔다" 까지만 보고,
 * 소비자가 하는 일은 {@link WalletProvisioner} 를 직접 불러 검증한다.
 */
class WalletProvisioningIntegrationTests extends PostgresIntegrationTest {

    private static final String EMAIL = "provision@teacat.local";
    private static final String TX_HASH = "0x" + "1".repeat(64);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WalletProvisioner walletProvisioner;

    @Autowired
    private WalletService walletService;

    @MockitoBean
    private BlockchainWalletClient blockchainWalletClient;

    @MockitoBean
    private RabbitTemplate rabbitTemplate;

    @Test
    void 가입은_지갑을_만들지_않고_발급_요청만_남긴다() throws Exception {
        signup();

        Map<String, Object> provision = provisionOf(EMAIL);
        assertThat(provision.get("status")).isEqualTo("PENDING");
        assertThat(provision.get("derivation_index")).isNull();
        assertThat(walletOwnerCount()).isZero();
        verify(blockchainWalletClient, never()).createWallet(anyInt(), any());
    }

    @Test
    void 가입이_커밋되면_메시지가_나간다() throws Exception {
        signup();

        Long provisionId = ((Number) provisionOf(EMAIL).get("id")).longValue();
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitConfig.WALLET_EXCHANGE),
                eq(RabbitConfig.WALLET_PROVISION_ROUTING_KEY),
                eq(new WalletProvisionMessage(provisionId)));
    }

    @Test
    void 요청을_처리하면_지갑이_생기고_DONE_이_된다() throws Exception {
        signup();
        stubChainSuccess();
        Long provisionId = ((Number) provisionOf(EMAIL).get("id")).longValue();

        assertThat(walletProvisioner.provision(provisionId)).isTrue();

        Map<String, Object> provision = provisionOf(EMAIL);
        assertThat(provision.get("status")).isEqualTo("DONE");
        assertThat(provision.get("provisioned_at")).isNotNull();
        assertThat(walletOwnerCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_seed_grants", Integer.class)).isEqualTo(1);
        // 지갑의 파생 인덱스는 요청 행에 먼저 저장된 값과 같다
        Integer ownerIndex = jdbcTemplate.queryForObject(
                "SELECT derivation_index FROM wallet_owners", Integer.class);
        assertThat(ownerIndex).isEqualTo(provision.get("derivation_index"));
    }

    @Test
    void 같은_요청을_두_번_처리해도_지갑은_하나다() throws Exception {
        signup();
        stubChainSuccess();
        Long provisionId = ((Number) provisionOf(EMAIL).get("id")).longValue();

        assertThat(walletProvisioner.provision(provisionId)).isTrue();
        assertThat(walletProvisioner.provision(provisionId)).isFalse();

        assertThat(walletOwnerCount()).isEqualTo(1);
        verify(blockchainWalletClient, times(1)).createWallet(anyInt(), any());
    }

    @Test
    void 체인이_실패하면_PENDING_으로_남고_다음_시도는_같은_인덱스를_쓴다() throws Exception {
        signup();
        Long provisionId = ((Number) provisionOf(EMAIL).get("id")).longValue();
        given(blockchainWalletClient.createWallet(anyInt(), any()))
                .willThrow(new BusinessException(WalletErrorCode.WALLET_CREATION_FAILED));

        assertThatThrownBy(() -> walletProvisioner.provision(provisionId))
                .isInstanceOf(BusinessException.class);

        Map<String, Object> afterFailure = provisionOf(EMAIL);
        assertThat(afterFailure.get("status")).isEqualTo("PENDING");
        assertThat(afterFailure.get("attempts")).isEqualTo(1);
        assertThat(afterFailure.get("last_error")).isNotNull();
        Integer firstIndex = (Integer) afterFailure.get("derivation_index");
        assertThat(firstIndex).isNotNull();

        stubChainSuccess();
        assertThat(walletProvisioner.provision(provisionId)).isTrue();

        verify(blockchainWalletClient, times(2)).createWallet(eq(firstIndex), any());
        assertThat(walletOwnerCount()).isEqualTo(1);
    }

    @Test
    void 지갑이_준비되기_전에는_준비_중이라고_답한다() throws Exception {
        signup();
        Long userId = jdbcTemplate.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, EMAIL);

        assertThatThrownBy(() -> walletService.resolveWallet(userId))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(WalletErrorCode.WALLET_PROVISIONING));

        stubChainSuccess();
        walletProvisioner.provision(((Number) provisionOf(EMAIL).get("id")).longValue());

        assertThat(walletService.resolveWallet(userId).getAddress()).startsWith("0x");
    }

    @Test
    void 발급_요청조차_없는_회원은_지갑_없음이다() {
        Long userId = insertUser("legacy@teacat.local", "레거시");

        assertThatThrownBy(() -> walletService.resolveWallet(userId))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(WalletErrorCode.WALLET_NOT_FOUND));
    }

    /** 실패 스텁 위에 덧씌울 수 있어야 하므로 given(...) 대신 doAnswer 를 쓴다 — given 은 스텁된 메서드를 실제로 부른다 */
    private void stubChainSuccess() {
        doAnswer(invocation -> new WalletCreationResponse(
                "0x%040X".formatted(invocation.<Integer>getArgument(0)),
                invocation.getArgument(0),
                "m/44'/60'/0'/0/" + invocation.getArgument(0),
                "RELAYER_EOA",
                new WalletCreationResponse.Seed("PENDING", BigInteger.valueOf(1_500).toString(), TX_HASH)))
                .when(blockchainWalletClient).createWallet(anyInt(), any());
    }

    private void signup() throws Exception {
        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "teacat1234!",
                                  "name": "지갑 테스트",
                                  "nickname": "지갑테스트",
                                  "phone": "010-0000-0010"
                                }
                                """.formatted(EMAIL)))
                .andExpect(status().isCreated());
    }

    private Map<String, Object> provisionOf(String email) {
        return jdbcTemplate.queryForMap("""
                SELECT p.id, p.status::text AS status, p.derivation_index, p.attempts, p.last_error, p.provisioned_at
                FROM wallet_provisions p
                         JOIN users u ON u.id = p.user_id
                WHERE u.email = ?
                """, email);
    }

    private int walletOwnerCount() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM wallet_owners", Integer.class);
    }
}
