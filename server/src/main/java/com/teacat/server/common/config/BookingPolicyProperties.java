package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 booking.policy.* 설정 (API-205).
 *
 * 공연별로 다르게 줄 수 있는 값이 아니라 서비스 전체 정책이다.
 *
 * 취소 마감은 회차의 공연 일시에서 {@code cancelDeadlineLead} 를 뺀 시각이다.
 * 실제 시각은 회차 조회(API-203)의 {@code cancelDeadlineAt} 이 내려준다.
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
        boolean faceVerificationRequired,

        /**
         * 예매 취소 마감 = 공연 시작 − 이 값.
         *
         * 🔴 <b>카드팩 개봉 시각도 같은 값을 읽는다</b> (TicketOrderRecorder). 둘이 어긋나면
         * 그 차이만큼 "카드를 뽑고 예매를 취소해 전액 환불받는" 창이 열린다.
         * 한쪽만 바꾸지 말 것.
         */
        Duration cancelDeadlineLead
) {
}
