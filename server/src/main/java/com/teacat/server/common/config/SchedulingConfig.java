package com.teacat.server.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 주기 작업 활성화.
 *
 * 체인 쓰기는 보낸 즉시 확정되지 않고(블록 10초), 결제는 응답을 받기 전에 끊길 수 있다.
 * 두 경우 모두 요청 스레드가 아니라 주기 작업이 뒤를 따라간다.
 *
 * <b>인스턴스가 하나라는 전제다.</b> 여러 대로 늘리면 같은 건을 중복 처리하므로
 * (조회·멱등 요청이라 위험하진 않지만 낭비다) 분산 락이 필요하다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
