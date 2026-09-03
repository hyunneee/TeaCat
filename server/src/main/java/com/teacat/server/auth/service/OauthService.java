package com.teacat.server.auth.service;

import com.teacat.server.auth.client.OauthProfile;
import com.teacat.server.auth.client.SsafyOauthClient;
import com.teacat.server.auth.client.SsafyOauthProperties;
import com.teacat.server.auth.dto.request.OauthSignupRequest;
import com.teacat.server.auth.dto.response.LoginResult;
import com.teacat.server.auth.dto.response.OauthCallbackResult;
import com.teacat.server.auth.dto.response.PendingSignupResponse;
import com.teacat.server.auth.dto.response.TokenPair;
import com.teacat.server.auth.entity.OauthAccount;
import com.teacat.server.auth.entity.OauthProvider;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.repository.OauthAccountRepository;
import com.teacat.server.auth.repository.OauthSignupTicketRepository;
import com.teacat.server.auth.repository.OauthStateRepository;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.auth.security.RefreshTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.dto.response.MyInfoResponse;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

/**
 * SSAFY 계정 로그인 (OAuth 2.0 Authorization Code).
 *
 * 흐름:
 *   1. authorize  — state 를 만들어 두고 SSAFY 로그인 주소를 알려준다
 *   2. callback   — state 검증 → 코드 교환 → 프로필 조회
 *                   이미 회원이면 토큰 발급, 처음이면 가입 티켓 발급
 *   3. signup     — 닉네임·전화번호를 받아 회원을 만들고 토큰 발급
 *
 * 회원을 콜백에서 미리 만들지 않는 이유: 닉네임·전화번호가 빈 "유령 회원" 이 남기 때문이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OauthService {

    private static final OauthProvider PROVIDER = OauthProvider.SSAFY;
    private static final Duration STATE_TTL = Duration.ofMinutes(5);
    private static final Duration SIGNUP_TICKET_TTL = Duration.ofMinutes(10);
    private static final int TOKEN_BYTE_LENGTH = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    private final SsafyOauthClient ssafyOauthClient;
    private final SsafyOauthProperties ssafyOauthProperties;
    private final OauthStateRepository oauthStateRepository;
    private final OauthSignupTicketRepository oauthSignupTicketRepository;
    private final OauthAccountRepository oauthAccountRepository;
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenProvider refreshTokenProvider;

    public Duration getSignupTicketValidity() {
        return SIGNUP_TICKET_TTL;
    }

    /** 사용자를 보낼 SSAFY 로그인 주소 */
    public String buildAuthorizationUri() {
        requireConfigured();

        String state = randomToken();
        oauthStateRepository.save(state, STATE_TTL);

        return ssafyOauthClient.buildAuthorizationUri(state);
    }

    @Transactional
    public OauthCallbackResult handleCallback(String code, String state) {
        requireConfigured();

        // state 는 우리가 시작한 인가인지 확인하는 일회용 값이다(CSRF 방지)
        if (!StringUtils.hasText(code) || !StringUtils.hasText(state) || !oauthStateRepository.consume(state)) {
            throw new BusinessException(AuthErrorCode.OAUTH_STATE_INVALID);
        }

        OauthProfile profile = ssafyOauthClient.fetchProfile(ssafyOauthClient.exchangeCodeForAccessToken(code));

        return findLinkedUser(profile)
                .map(user -> OauthCallbackResult.loggedIn(issueTokens(user)))
                .orElseGet(() -> OauthCallbackResult.signupRequired(issueSignupTicket(profile)));
    }

    /** 추가정보 입력 화면이 SSAFY 가 알려준 값을 미리 채우기 위해 부른다 */
    public PendingSignupResponse getPendingSignup(String ticket) {
        return PendingSignupResponse.from(readTicket(ticket));
    }

    /** 추가정보를 받아 회원을 만들고 로그인까지 끝낸다 */
    @Transactional
    public LoginResult completeSignup(String ticket, OauthSignupRequest request) {
        OauthProfile profile = readTicket(ticket);

        if (!StringUtils.hasText(profile.email())) {
            throw new BusinessException(AuthErrorCode.OAUTH_EMAIL_REQUIRED);
        }
        if (userRepository.existsByEmail(profile.email())) {
            // 콜백 이후 같은 이메일로 일반 가입이 끝난 드문 경우
            throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_NICKNAME);
        }

        User user = userRepository.save(User.createSocial(
                profile.email(),
                request.name(),
                request.nickname(),
                request.phone()
        ));
        link(user, profile);

        // 티켓은 한 번만 쓴다
        oauthSignupTicketRepository.delete(ticket);

        return new LoginResult(issueTokens(user), MyInfoResponse.from(user));
    }

    /**
     * 이미 연결된 계정 → 이메일이 같은 기존 회원 순으로 찾는다.
     *
     * 이메일이 같으면 같은 사람으로 보고 자동으로 연결한다(SSAFY 가 검증한 이메일이라는 전제).
     */
    private Optional<User> findLinkedUser(OauthProfile profile) {
        Optional<OauthAccount> account =
                oauthAccountRepository.findByProviderAndProviderUserId(PROVIDER, profile.providerUserId());

        if (account.isPresent()) {
            Optional<User> user = userRepository.findById(account.get().getUser().getId());

            if (user.isPresent()) {
                return user;
            }
            // 탈퇴한 회원에 걸린 연결은 의미가 없다. 지우고 새로 가입시킨다
            oauthAccountRepository.delete(account.get());
        }

        if (!StringUtils.hasText(profile.email())) {
            return Optional.empty();
        }

        Optional<User> byEmail = userRepository.findByEmail(profile.email());
        byEmail.ifPresent(user -> link(user, profile));

        return byEmail;
    }

    private void link(User user, OauthProfile profile) {
        oauthAccountRepository.save(
                OauthAccount.link(user, PROVIDER, profile.providerUserId(), profile.email()));
    }

    private String issueSignupTicket(OauthProfile profile) {
        String ticket = randomToken();
        oauthSignupTicketRepository.save(ticket, profile, SIGNUP_TICKET_TTL);
        return ticket;
    }

    private OauthProfile readTicket(String ticket) {
        if (!StringUtils.hasText(ticket)) {
            throw new BusinessException(AuthErrorCode.OAUTH_SIGNUP_EXPIRED);
        }

        return oauthSignupTicketRepository.find(ticket)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.OAUTH_SIGNUP_EXPIRED));
    }

    private TokenPair issueTokens(User user) {
        return new TokenPair(
                jwtTokenProvider.createAccessToken(user.getId(), user.getRole()),
                jwtTokenProvider.getAccessTokenValiditySeconds(),
                refreshTokenProvider.issue(user.getId())
        );
    }

    private void requireConfigured() {
        if (!ssafyOauthProperties.isConfigured()) {
            throw new BusinessException(AuthErrorCode.OAUTH_NOT_CONFIGURED);
        }
    }

    private String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
