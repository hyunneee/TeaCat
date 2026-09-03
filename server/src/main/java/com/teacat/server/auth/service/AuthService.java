package com.teacat.server.auth.service;

import com.teacat.server.auth.dto.request.LoginRequest;
import com.teacat.server.auth.dto.request.SignupRequest;
import com.teacat.server.auth.dto.response.LoginResult;
import com.teacat.server.auth.dto.response.SignupResponse;
import com.teacat.server.auth.dto.response.TokenPair;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.auth.security.RefreshTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.dto.response.MyInfoResponse;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    /** 가입 축하금 (API-101) */
    private static final long SIGNUP_REWARD_CAT = 1_500L;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenProvider refreshTokenProvider;

    /**
     * 회원가입 (API-101).
     *
     * 회원 생성과 1,500 CAT 지급은 한 트랜잭션으로 처리해야 한다.
     * 지갑 생성 API 가 아직 없어서 지금은 회원 생성까지만 수행한다.
     */
    @Transactional
    public SignupResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_NICKNAME);
        }

        User user = userRepository.save(User.create(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.name(),
                request.nickname(),
                request.phone()
        ));

        // TODO(wallet): 지갑 생성 API 가 나오면 아래를 풀어 같은 트랜잭션 안에서 지급까지 끝낸다.
        //  Wallet wallet = walletService.create(user.getId());
        //  tokenService.grant(wallet, SIGNUP_REWARD_CAT);

        return SignupResponse.from(user);
    }

    /**
     * 로그인.
     *
     * 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다(계정 존재 여부 노출 방지).
     */
    public LoginResult login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(AuthErrorCode.LOGIN_FAILED));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(AuthErrorCode.LOGIN_FAILED);
        }

        return new LoginResult(issueTokens(user), MyInfoResponse.from(user));
    }

    /**
     * 액세스 토큰 재발급 (자동 로그인).
     *
     * 한 번 쓴 리프레시 토큰은 즉시 폐기하고 새로 발급한다(회전).
     * 탈퇴한 회원은 조회되지 않으므로 자연히 재발급이 막힌다.
     */
    public TokenPair reissue(String refreshToken) {
        if (!StringUtils.hasText(refreshToken)) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_REQUIRED);
        }

        Long userId = refreshTokenProvider.resolveUserId(refreshToken);
        refreshTokenProvider.revoke(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_REFRESH_TOKEN));

        return issueTokens(user);
    }

    /**
     * 로그아웃.
     *
     * 이미 지워진 토큰으로 다시 불러도 실패로 취급하지 않는다(멱등).
     * 액세스 토큰은 만료(기본 1시간)까지 유효하다 — 즉시 차단이 필요해지면 블랙리스트를 도입해야 한다.
     */
    public void logout(String refreshToken) {
        if (StringUtils.hasText(refreshToken)) {
            refreshTokenProvider.revoke(refreshToken);
        }
    }

    private TokenPair issueTokens(User user) {
        return new TokenPair(
                jwtTokenProvider.createAccessToken(user.getId(), user.getRole()),
                jwtTokenProvider.getAccessTokenValiditySeconds(),
                refreshTokenProvider.issue(user.getId())
        );
    }
}
