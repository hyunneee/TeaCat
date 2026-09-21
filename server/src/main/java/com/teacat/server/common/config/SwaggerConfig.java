package com.teacat.server.common.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@OpenAPIDefinition(
        info = @Info(
                title = "TeaCat API",
                description = "TeaCat REST API 명세서"
        )
)
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "로그인으로 받은 액세스 토큰을 입력합니다. (Bearer 접두어 제외)"
)
@Configuration
public class SwaggerConfig {

    private static final String BASE_PACKAGE = "com.teacat.server";

    /**
     * 그룹은 경로가 아니라 <b>도메인 패키지</b> 기준으로 나눈다.
     * URL 이 바뀌어도 그룹이 깨지지 않고, 도메인별 패키지 구조와 1:1 로 맞물린다.
     * <p>
     * 도메인을 추가하면 여기에 빈을 하나 추가한다. 그룹 이름의 숫자 접두어는 정렬용이다.
     */
    @Bean
    public GroupedOpenApi allApi() {
        return GroupedOpenApi.builder()
                .group("00-all")
                .displayName("전체")
                .packagesToScan(BASE_PACKAGE)
                .build();
    }

    @Bean
    public GroupedOpenApi authApi() {
        return GroupedOpenApi.builder()
                .group("01-auth")
                .displayName("인증")
                .packagesToScan(BASE_PACKAGE + ".auth")
                .build();
    }

    @Bean
    public GroupedOpenApi userApi() {
        return GroupedOpenApi.builder()
                .group("02-user")
                .displayName("회원")
                .packagesToScan(BASE_PACKAGE + ".user")
                .build();
    }

    @Bean
    public GroupedOpenApi walletApi() {
        return GroupedOpenApi.builder()
                .group("03-wallet")
                .displayName("지갑")
                .packagesToScan(BASE_PACKAGE + ".wallet")
                .build();
    }

    @Bean
    public GroupedOpenApi performanceApi() {
        return GroupedOpenApi.builder()
                .group("05-performance")
                .displayName("공연")
                .packagesToScan(BASE_PACKAGE + ".performance")
                .build();
    }

    @Bean
    public GroupedOpenApi nftApi() {
        return GroupedOpenApi.builder()
                .group("04-nft")
                .displayName("NFT 포토카드")
                .packagesToScan(BASE_PACKAGE + ".nft")
                .build();
    }

    @Bean
    public GroupedOpenApi ticketApi() {
        return GroupedOpenApi.builder()
                .group("08-ticket")
                .displayName("티켓")
                .packagesToScan(BASE_PACKAGE + ".ticket")
                .build();
    }

    @Bean
    public GroupedOpenApi paymentApi() {
        return GroupedOpenApi.builder()
                .group("07-payment")
                .displayName("결제")
                .packagesToScan(BASE_PACKAGE + ".payment")
                .build();
    }

    // 04 는 nft, 05 는 performance 가 이미 쓰고 있어 06 을 쓴다.
    // 접두어는 문서 주소용이고 드롭다운 정렬은 displayName 기준이라 번호 자체는 순서에 영향이 없다.
    @Bean
    public GroupedOpenApi bookingApi() {
        return GroupedOpenApi.builder()
                .group("06-booking")
                .displayName("예매")
                .packagesToScan(BASE_PACKAGE + ".booking")
                .build();
    }

    @Bean
    public GroupedOpenApi stadiumApi() {
        return GroupedOpenApi.builder()
                .group("07-stadium")
                .displayName("공연장")
                .packagesToScan(BASE_PACKAGE + ".stadium")
                .build();
    }

    @Bean
    public GroupedOpenApi inquiryApi() {
        return GroupedOpenApi.builder()
                .group("08-inquiry")
                .displayName("문의")
                .packagesToScan(BASE_PACKAGE + ".inquiry")
                .build();
    }

    @Bean
    public GroupedOpenApi bannerApi() {
        return GroupedOpenApi.builder()
                .group("09-banner")
                .displayName("메인 배너")
                .packagesToScan(BASE_PACKAGE + ".banner")
                .build();
    }

    @Bean
    public GroupedOpenApi queueApi() {
        return GroupedOpenApi.builder()
                .group("11-queue")
                .displayName("가상 대기실")
                .packagesToScan(BASE_PACKAGE + ".queue")
                .build();
    }

    @Bean
    public GroupedOpenApi analyticsApi() {
        return GroupedOpenApi.builder()
                .group("10-analytics")
                .displayName("운영 통계")
                .packagesToScan(BASE_PACKAGE + ".analytics")
                .build();
    }

    @Bean
    public GroupedOpenApi resaleApi() {
        return GroupedOpenApi.builder()
                .group("12-resale")
                .displayName("취소표 대기")
                .packagesToScan(BASE_PACKAGE + ".resale")
                .build();
    }

    @Bean
    public GroupedOpenApi notificationApi() {
        return GroupedOpenApi.builder()
                .group("13-notification")
                .displayName("알림")
                .packagesToScan(BASE_PACKAGE + ".notification")
                .build();
    }
}
