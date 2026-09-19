package com.teacat.server.auth.service;

import com.teacat.server.auth.dto.request.LoginRequest;
import com.teacat.server.auth.dto.request.SignupRequest;
import com.teacat.server.auth.dto.response.LoginResult;
import com.teacat.server.auth.dto.response.SignupResponse;
import com.teacat.server.auth.dto.response.TokenPair;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.ClientRequest;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.auth.security.RefreshTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.dto.response.MyInfoResponse;
import com.teacat.server.user.entity.Face;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenProvider refreshTokenProvider;
    private final WalletService walletService;
    private final LoginEventRecorder loginEventRecorder;

    /**
     * 회원가입 (API-101).
     *
     * 회원 생성과 지갑 발급(1,500 CAT 지급 포함)을 한 트랜잭션으로 처리한다.
     * 지갑 발급이 실패하면 회원 생성도 함께 롤백되어 사용자가 다시 가입할 수 있다.
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

        /* 얼굴 자리를 미리 채운다 — 등록을 안 해도 예매까지 갈 수 있어야 한다.
           사람 얼굴에서 뽑은 값이 아니고, 본인 확인은 모델 버전이 달라 거절된다
           (Face.DEFAULT_MODEL_VERSION 주석). 나중에 진짜로 등록하면 덮어쓴다. */
        user.registerFace(Face.defaultFace());

        // 실패하면 예외가 올라가 회원 생성까지 롤백된다
        walletService.provision(user);

        return SignupResponse.from(user);
    }

    /**
     * 로그인.
     *
     * 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다(계정 존재 여부 노출 방지).
     */
    public LoginResult login(LoginRequest request, ClientRequest client) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(AuthErrorCode.LOGIN_FAILED));

        // 소셜 전용 계정은 비밀번호가 없다. 있는 척 알려주지 않고 같은 실패로 처리한다
        if (!user.hasPassword() || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(AuthErrorCode.LOGIN_FAILED);
        }

        // 이상거래 심사(R8)용 단말 기록. 실패해도 로그인은 그대로 성공한다
        loginEventRecorder.record(user.getId(), client);
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

    /**
     * 이 회원의 모든 세션을 끊는다 (비밀번호 변경 · 탈퇴).
     *
     * 리프레시 토큰을 전부 지우므로 다른 기기는 재발급을 못 하고 튕긴다.
     *
     * ⚠️ 이미 발급된 액세스 토큰은 만료(기본 1시간)까지 살아 있다. 무상태 검증이라
     *    서버가 개별 토큰을 막을 방법이 없다. 즉시 차단까지 필요해지면
     *    블랙리스트나 토큰 버전 클레임을 도입해야 한다.
     */
    public void revokeAllSessions(Long userId) {
        refreshTokenProvider.revokeAll(userId);
    }

    private TokenPair issueTokens(User user) {
        return new TokenPair(
                jwtTokenProvider.createAccessToken(user.getId(), user.getRole()),
                jwtTokenProvider.getAccessTokenValiditySeconds(),
                refreshTokenProvider.issue(user.getId())
        );
    }
}
