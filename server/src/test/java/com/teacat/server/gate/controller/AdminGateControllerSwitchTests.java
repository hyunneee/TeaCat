package com.teacat.server.gate.controller;

import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 검표 API 는 <b>기본적으로 존재하지 않는다.</b>
 *
 * <p>이걸 테스트로 못 박는 이유는, 이 기능을 <b>운영에 올리면서 켜지 않는 것</b>이 Phase 1 의
 * 전제이기 때문이다. 아직 입장 절차를 운영하지 않으므로 남의 티켓을 1:N 으로 훑는
 * 엔드포인트가 열려 있어서는 안 된다.
 *
 * <p>주석으로 막았다면 이런 테스트를 쓸 수 없다 — 주석 안의 코드는 컴파일조차 되지 않는다.
 * 스위치라서 <b>꺼진 상태를 검증할 수 있다.</b>
 *
 * <p>이 클래스는 {@code gate.enabled} 를 건드리지 않는다. application.yaml 의 기본값
 * ({@code GATE_ENABLED:false})이 그대로 적용되는 것이 요점이다 — 누군가 기본값을 true 로
 * 바꾸면 여기서 걸린다.
 */
class AdminGateControllerSwitchTests extends PostgresIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void 기본값으로는_검표_컨트롤러가_뜨지_않는다() {
        assertThat(context.getBeanNamesForType(AdminGateController.class)).isEmpty();
    }

    @Test
    void 켜지_않아도_검표_서비스는_그대로_컴파일되고_빈으로_존재한다() {
        /* 컨트롤러만 조건부다. 서비스까지 막으면 이 도메인은 테스트할 수 없는 코드가 되고,
           그건 "주석으로 묶어 두는 것" 과 사실상 같아진다 — 쓰이지 않는 채로 조용히 썩는다.
           GateVerifyIntegrationTests 가 스위치와 무관하게 도는 근거가 이것이다. */
        assertThat(context.getBeanNamesForType(
                com.teacat.server.gate.service.GateVerifyService.class)).isNotEmpty();
    }
}
