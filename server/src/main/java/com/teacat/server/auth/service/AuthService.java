package com.teacat.server.auth.service;

import com.teacat.server.auth.dto.request.LoginRequest;
import com.teacat.server.auth.dto.request.SignupRequest;
import com.teacat.server.auth.dto.response.LoginResponse;
import com.teacat.server.auth.dto.response.SignupResponse;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    /** 가입 축하금 (API-101) */
    private static final long SIGNUP_REWARD_CAT = 1_500L;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

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
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(AuthErrorCode.LOGIN_FAILED));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(AuthErrorCode.LOGIN_FAILED);
        }

        return LoginResponse.of(
                jwtTokenProvider.createAccessToken(user.getId(), user.getRole()),
                jwtTokenProvider.getAccessTokenValiditySeconds()
        );
    }
}
