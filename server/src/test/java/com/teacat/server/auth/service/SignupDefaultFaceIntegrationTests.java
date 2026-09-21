package com.teacat.server.auth.service;

import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.dto.request.FaceRegisterRequest;
import com.teacat.server.user.entity.Face;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.user.service.UserService;
import com.teacat.server.wallet.client.BlockchainWalletClient;
import com.teacat.server.wallet.client.WalletCreationResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 가입하면 얼굴 자리가 채워진다 — 등록을 안 해도 예매까지 갈 수 있어야 한다.
 *
 * <p>🔴 <b>가입 경로를 실제로 태우는 것이 요점이다.</b> 얼굴을 넣는 자리가 회원 생성과
 * <b>같은 트랜잭션</b>이라, 서비스 메서드만 따로 부르면 그 관계가 검증되지 않는다.
 *
 * <p>지갑은 가입 트랜잭션 밖(큐)에서 만들어지므로 이 테스트는 체인을 부르지 않는다.
 * 그쪽은 {@code WalletProvisioningIntegrationTests} 가 본다.
 *
 * <p>확인은 {@code users.face_id} 와 {@code faces.model_version} 을 <b>직접</b> 읽는다.
 * 엔티티의 {@code getFace()} 는 지연 로딩이라 트랜잭션 밖에서 터지고, 무엇보다
 * 우리가 보고 싶은 것은 "DB 에 무엇이 남았나" 이다.
 */
class SignupDefaultFaceIntegrationTests extends PostgresIntegrationTest {

    private static final String EMAIL = "signup-face@teacat.local";
    private static final String REAL_MODEL = "yunet2023mar+sface2021dec-int8@1";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @MockitoBean
    private BlockchainWalletClient blockchainWalletClient;

    @BeforeEach
    void stubWallet() {
        given(blockchainWalletClient.createWallet(anyInt(), any()))
                .willAnswer(invocation -> new WalletCreationResponse(
                        "0x%040x".formatted(invocation.<Integer>getArgument(0)),
                        invocation.getArgument(0),
                        "m/44'/60'/0'/0/0",
                        "RELAYER_EOA",
                        null));
    }

    @Test
    void 가입하면_기본_얼굴이_채워진다() throws Exception {
        signup();

        assertThat(modelVersionOf(EMAIL)).isEqualTo(Face.DEFAULT_MODEL_VERSION);
    }

    /**
     * 🔴 기본 얼굴의 모델 버전은 <b>실제 모델과 달라야 한다.</b>
     *
     * <p>같으면 본인 확인이 이 값과 진짜 얼굴을 대조하려 든다. 그 순간 모든 계정에 똑같이
     * 들어 있는 이 값이 <b>만능 열쇠</b>가 된다 — 이 벡터를 만들어 낼 수 있는 사람은
     * 아무 계정으로나 통과한다. 달라야 대조 전에 {@code FACE_MODEL_MISMATCH} 로 거절된다.
     */
    @Test
    void 기본_얼굴은_실제_모델과_다른_버전으로_저장된다() throws Exception {
        signup();

        assertThat(modelVersionOf(EMAIL)).isNotEqualTo(REAL_MODEL);
    }

    /**
     * 자리 표시가 있다고 "이미 등록됨"으로 막으면, 실제 얼굴을 넣으려는 사람이
     * 삭제부터 해야 한다. 덮어쓰게 둔다.
     */
    @Test
    void 진짜_얼굴을_등록하면_기본_얼굴을_덮어쓴다() throws Exception {
        signup();
        Long userId = userRepository.findByEmail(EMAIL).orElseThrow().getId();

        userService.registerFace(userId, new FaceRegisterRequest(realEmbedding(), REAL_MODEL));

        assertThat(modelVersionOf(EMAIL)).isEqualTo(REAL_MODEL);
    }

    private void signup() throws Exception {
        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "teacat1234!",
                                  "name": "얼굴 테스트",
                                  "nickname": "얼굴테스트",
                                  "phone": "010-0000-0009"
                                }
                                """.formatted(EMAIL)))
                .andExpect(status().isCreated());
    }

    /** 이 회원에게 실제로 붙어 있는 얼굴의 모델 버전. 얼굴이 없으면 테스트가 여기서 깨진다 */
    private String modelVersionOf(String email) {
        return jdbcTemplate.queryForObject("""
                SELECT f.model_version
                FROM users u
                         JOIN faces f ON f.id = u.face_id
                WHERE u.email = ?
                """, String.class, email);
    }

    /** 사람 얼굴에서 뽑은 값은 아니지만, 기본 얼굴과 다른 값이면 이 테스트에는 충분하다 */
    private float[] realEmbedding() {
        float[] embedding = new float[Face.EMBEDDING_DIMENSION];
        Arrays.fill(embedding, 0.05f);
        embedding[0] = 0.9f;
        return embedding;
    }
}
