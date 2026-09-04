package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 booking.policy.* 설정 (API-205).
 *
 * 공연별로 다르게 줄 수 있는 값이 아니라 서비스 전체 정책이다.
 * 1인 최대 매수는 운영 판단으로 바뀌는 값이라 코드에 박지 않고 설정으로 둔다.
 * 공연마다 다르게 하려면 performance_general 에 컬럼을 추가해야 한다.
 *
 * 취소 마감은 설정이 아니다. "공연 시작 전까지" 로 고정이고,
 * 실제 시각은 회차의 공연 일시라서 회차 조회(API-203)가 내려준다.
 */
@ConfigurationProperties(prefix = "booking.policy")
public record BookingPolicyProperties(

        /** 1인이 한 회차에서 살 수 있는 최대 매수 */
        int maxTicketsPerUser,

        /**
         * 예매 시 동행자 지정을 필수로 할지.
         *
         * 1인 1매 정책에서는 동행자를 지정할 여지가 없어 끈다.
         * 매수 제한을 늘리면 매크로가 여러 장을 쓸어가는 것을 막기 위해 다시 켜야 한다.
         */
        boolean companionRequired,

        /** 입장 시 얼굴 인증을 요구할지 */
        boolean faceVerificationRequired
) {
}
