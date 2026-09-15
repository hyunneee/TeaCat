package com.teacat.server.user.service;

import com.teacat.server.auth.service.AuthService;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.dto.request.AdminPasswordResetRequest;
import com.teacat.server.user.dto.request.AdminUserCreateRequest;
import com.teacat.server.user.dto.request.AdminUserUpdateRequest;
import com.teacat.server.user.dto.response.AdminUserPageResponse;
import com.teacat.server.user.dto.response.AdminUserResponse;
import com.teacat.server.user.dto.response.AdminUserStatsResponse;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;

/**
 * 관리자 회원 관리.
 *
 * <p>본인 정보를 바꾸는 {@link UserService} 와 분리한다. 여기 있는 메서드는 전부
 * "남의 계정을 관리자가 바꾼다" 이고, 다음 두 가지가 항상 따라붙기 때문이다.
 * <ul>
 *   <li>스스로를 잠그지 못하게 막는 규칙 (본인 계정 · 마지막 관리자)</li>
 *   <li>바꾼 뒤 그 회원의 세션 끊기 — 액세스 토큰에 역할이 담겨 있다</li>
 * </ul>
 *
 * <p>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**} 규칙(ADMIN 전용)이 담당한다.
 * 여기서 역할을 다시 검사하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    /** 대시보드 "최근 가입" 카드의 기준 기간 */
    private static final int RECENT_JOIN_DAYS = 7;

    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final WalletService walletService;
    /** 탈퇴할 때 티켓에 베껴 둔 얼굴까지 지우려면 필요합니다 (User.withdraw 주석) */
    private final TicketRepository ticketRepository;

    /* ── 조회 ────────────────────────────────────────────────── */

    /**
     * 회원 목록. 최근 가입 순이다.
     *
     * @param keyword 이메일·이름·닉네임·전화번호 부분 일치. 비우면 전체
     * @param role    비우면 전체 역할
     */
    public AdminUserPageResponse list(String keyword, UserRole role, int page, int size) {
        PageRequest pageRequest = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(size, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        String pattern = toLikePattern(keyword);

        Page<User> found = role == null
                ? userRepository.search(pattern, pageRequest)
                : userRepository.searchByRole(role, pattern, pageRequest);

        return AdminUserPageResponse.from(found, found.getContent().stream()
                .map(AdminUserResponse::from)
                .toList());
    }

    public AdminUserResponse get(Long userId) {
        return AdminUserResponse.from(getUser(userId));
    }

    public AdminUserStatsResponse stats() {
        return AdminUserStatsResponse.of(
                userRepository.countGroupByRole(),
                userRepository.countFaceRegistered(),
                userRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(RECENT_JOIN_DAYS)));
    }

    /* ── 생성 ────────────────────────────────────────────────── */

    /**
     * 회원 생성. 역할을 지정할 수 있는 유일한 경로다.
     *
     * <p>🔴 지갑은 <b>USER 역할만</b> 발급한다. 지갑 발급은 체인에 캣머니를 발행하는
     * 트랜잭션(가스 소모)이고, 운영진 계정(ADMIN·STADIUM·PERFORMANCE)은 티켓을 사거나
     * 캣머니를 쓰지 않는다. 운영진 계정을 만들 때마다 시드를 태울 이유가 없다.
     *
     * <p>USER 를 만들 때는 일반 가입과 똑같이 지갑 발급이 실패하면 회원 생성까지
     * 롤백된다 — 지갑 없는 구매자가 남으면 티켓을 받을 수 없다.
     */
    @Transactional
    public AdminUserResponse create(AdminUserCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_NICKNAME);
        }

        User user = userRepository.save(User.createWithRole(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.name(),
                request.nickname(),
                request.phone(),
                request.role()));

        if (request.role() == UserRole.USER) {
            walletService.provision(user);
        }

        log.info("관리자가 회원을 생성했습니다. userId={} role={}", user.getId(), user.getRole());

        return AdminUserResponse.from(user);
    }

    /* ── 수정 ────────────────────────────────────────────────── */

    /**
     * 보낸 필드만 바꾼다.
     *
     * <p>역할이 바뀌면 그 회원의 세션을 끊는다. 액세스 토큰에 역할이 담겨 있어
     * 안 끊으면 최대 1시간 동안 옛 권한으로 계속 돈다.
     */
    @Transactional
    public AdminUserResponse update(Long actorId, Long userId, AdminUserUpdateRequest request) {
        User user = getManageableUser(actorId, userId);

        if (StringUtils.hasText(request.name())) {
            user.changeName(request.name());
        }
        if (StringUtils.hasText(request.phone())) {
            user.changePhone(request.phone());
        }

        if (StringUtils.hasText(request.nickname()) && !user.getNickname().equals(request.nickname())) {
            if (userRepository.existsByNickname(request.nickname())) {
                throw new BusinessException(UserErrorCode.DUPLICATE_NICKNAME);
            }
            user.changeNickname(request.nickname());
        }

        if (request.role() != null && request.role() != user.getRole()) {
            // 관리자를 다른 역할로 내리는 경우, 남은 관리자가 없어지면 아무도 못 들어온다
            requireAnotherAdminIfDemoting(user, request.role());

            user.changeRole(request.role());
            authService.revokeAllSessions(userId);
            log.info("관리자가 회원 역할을 변경했습니다. userId={} role={}", userId, request.role());
        }

        return AdminUserResponse.from(user);
    }

    /**
     * 비밀번호 초기화.
     *
     * <p>현재 비밀번호를 확인하지 않으므로 그 회원의 세션을 반드시 끊는다.
     * SSAFY 전용 계정은 비밀번호가 없어 거절한다 — 여기서 비밀번호를 심으면
     * 관리자만 아는 비밀번호로 로그인할 수 있는 계정이 된다.
     */
    @Transactional
    public void resetPassword(Long actorId, Long userId, AdminPasswordResetRequest request) {
        User user = getManageableUser(actorId, userId);

        if (!user.hasPassword()) {
            throw new BusinessException(UserErrorCode.SOCIAL_ACCOUNT_NO_PASSWORD);
        }

        user.changePassword(passwordEncoder.encode(request.newPassword()));
        authService.revokeAllSessions(userId);

        log.info("관리자가 회원 비밀번호를 초기화했습니다. userId={}", userId);
    }

    /**
     * 얼굴 정보 삭제.
     *
     * <p>"등록한 얼굴이 본인이 아니다" 같은 신고를 받았을 때 관리자가 풀어준다.
     * 다시 등록하는 건 본인이 한다 — 관리자는 남의 얼굴을 등록할 수 없다.
     */
    @Transactional
    public void deleteFace(Long actorId, Long userId) {
        User user = getManageableUser(actorId, userId);

        if (!user.hasFace()) {
            throw new BusinessException(UserErrorCode.FACE_NOT_FOUND);
        }

        user.removeFace();
        log.info("관리자가 회원 얼굴 정보를 삭제했습니다. userId={}", userId);
    }

    /**
     * 탈퇴 처리 (소프트 삭제).
     *
     * <p>행을 지우지 않는다. 티켓·지갑이 이 회원을 참조하고 있어 물리 삭제는
     * 외래키에 막히고, 지워지면 발권 이력이 사라진다.
     */
    @Transactional
    public void withdraw(Long actorId, Long userId) {
        User user = getManageableUser(actorId, userId);
        requireAnotherAdminIfDemoting(user, null);

        user.withdraw(LocalDateTime.now());
        /* 🔴 본인 탈퇴(UserService.withdraw)와 **같이** 티켓의 얼굴 복사본도 지운다.
           탈퇴 경로가 둘이라 한쪽만 지우면 관리자가 내린 탈퇴만 생체정보가 남는다. */
        ticketRepository.eraseFaceOf(userId);
        authService.revokeAllSessions(userId);

        log.info("관리자가 회원을 탈퇴 처리했습니다. userId={}", userId);
    }

    /* ── 내부 ────────────────────────────────────────────────── */

    /**
     * 관리 대상으로 꺼낸다.
     *
     * <p>🔴 본인 계정은 이 화면에서 못 바꾼다. 실수로 자기 역할을 내리거나
     * 자기를 탈퇴시키면 그 자리에서 대시보드에서 쫓겨난다. 본인 정보는
     * 마이페이지(= {@link UserService})에서 바꾼다.
     */
    private User getManageableUser(Long actorId, Long userId) {
        if (actorId.equals(userId)) {
            throw new BusinessException(UserErrorCode.CANNOT_MODIFY_SELF);
        }
        return getUser(userId);
    }

    /**
     * 관리자를 관리자가 아니게 만들 때, 다른 관리자가 남는지 확인한다.
     *
     * @param newRole 바꿀 역할. 탈퇴처럼 역할이 사라지는 경우 null
     */
    private void requireAnotherAdminIfDemoting(User user, UserRole newRole) {
        boolean losesAdmin = user.getRole() == UserRole.ADMIN && newRole != UserRole.ADMIN;

        if (losesAdmin && userRepository.countByRole(UserRole.ADMIN) <= 1) {
            throw new BusinessException(UserErrorCode.LAST_ADMIN_REQUIRED);
        }
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
    }

    /** 부분 일치 검색용. 대소문자를 무시하려고 소문자로 내린다. 비우면 전체(%) */
    private String toLikePattern(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return "%";
        }
        return "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
