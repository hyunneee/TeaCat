package com.teacat.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// 폼 로그인을 쓰지 않으므로 개발용 임시 사용자(랜덤 비밀번호 로그)를 만들지 않는다
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class TeacatApplication {

    public static void main(String[] args) {
        SpringApplication.run(TeacatApplication.class, args);
    }

}
