package com.teacat.server.common.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@OpenAPIDefinition(
        info = @Info(
                title = "TeaCat API",
                description = "TeaCat REST API 명세서"
        )
)
@Configuration
public class SwaggerConfig {

    @Bean
    public GroupedOpenApi paymentOpenApi() {
        return GroupedOpenApi.builder()
                .group("결제 관련 API")
                .pathsToMatch("/api/payment/**")
                .build();
    }
}
