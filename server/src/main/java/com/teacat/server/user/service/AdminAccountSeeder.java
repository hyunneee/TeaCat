package com.teacat.server.user.service;

import com.teacat.server.common.config.AdminSeedProperties;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 서버가 뜰 때 관리자 계정을 하나 보장한다.
 *
 * <p><b>왜 필요한가</b> — 역할을 지정해 회원을 만들 수 있는 건 관리자뿐이고
 * 일반 가입은 항상 USER 다. 관리자가 0명이면 대시보드에 들어갈 방법이 아예 없다.
 * 그 닫힌 고리를 여기서 끊는다.
 *
 * <p><b>왜 Flyway 가 아닌가</b> — 비밀번호를 BCrypt 로 해싱해야 하고, 해시는
 * salt 때문에 매번 달라서 SQL 에 박아둘 수 없다. 박아두면 비밀번호를 바꿀 때
 * 마이그레이션을 새로 써야 하고, 해시가 저장소에 영구히 남는다.
 * 여기서는 앱의 {@link PasswordEncoder} 를 그대로 쓴다.
 *
 * <p><b>멱등하다</b> — ADMIN 이 이미 하나라도 있으면 아무것도 하지 않는다.
 * 시드 계정의 비밀번호를 바꿔뒀어도 재시작할 때 되돌려놓지 않는다.
 *
 * <p>🔴 지갑은 만들지 않는다. 운영진 계정은 티켓을 사지 않고, 무엇보다
 * 지갑 발급은 체인 호출이라 체인이 죽어 있으면 서버 기동이 실패한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountSeeder implements ApplicationRunner {

    private final AdminSeedProperties properties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.enabled()) {
            return;
        }

        // 관리자가 이미 있으면 손대지 않는다. 시드 계정을 지웠거나 이메일을 바꿔 쓰는 경우까지 포함
        if (userRepository.countByRole(UserRole.ADMIN) > 0) {
            return;
        }

        // 역할만 USER 로 남아 있는 동명 계정이 있을 수 있다. 그건 건드리지 않고 비켜간다
        if (userRepository.existsByEmail(properties.email())
                || userRepository.existsByNickname(properties.nickname())) {
            log.warn("관리자 시드를 건너뜁니다 — 같은 이메일 또는 닉네임의 회원이 이미 있습니다. "
                    + "그 계정의 역할을 ADMIN 으로 직접 올려주세요.");
            return;
        }

        User admin = userRepository.save(User.createWithRole(
                properties.email(),
                passwordEncoder.encode(properties.password()),
                properties.name(),
                properties.nickname(),
                properties.phone(),
                UserRole.ADMIN));

        // 🔴 비밀번호는 로그에 남기지 않는다 (CLAUDE.md 6장). 어디서 확인하는지만 알려준다
        log.warn("""

                        ────────────────────────────────────────────────────────────
                         관리자 계정을 새로 만들었습니다.  userId={}  email={}
                         비밀번호는 admin.seed.password 설정값입니다.
                         🔴 운영에서는 ADMIN_SEED_PASSWORD 로 덮어쓰거나
                            ADMIN_SEED_ENABLED=false 로 끄고 계정을 직접 만드세요.
                        ────────────────────────────────────────────────────────────""",
                admin.getId(), admin.getEmail());
    }
}
