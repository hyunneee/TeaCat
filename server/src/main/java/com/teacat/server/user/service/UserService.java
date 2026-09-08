package com.teacat.server.user.service;

import com.teacat.server.auth.service.AuthService;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.dto.request.FaceRegisterRequest;
import com.teacat.server.user.dto.request.NicknameChangeRequest;
import com.teacat.server.user.dto.request.PasswordChangeRequest;
import com.teacat.server.user.dto.response.MyInfoResponse;
import com.teacat.server.user.entity.Face;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    /** 내 정보 조회 (API-108) */
    public MyInfoResponse getMyInfo(Long userId) {
        return MyInfoResponse.from(getUser(userId));
    }

    /**
     * 비밀번호 변경 (API-104).
     *
     * 🔴 변경에 성공하면 이 회원의 리프레시 토큰을 **전부** 폐기한다.
     *    비밀번호를 바꾸는 이유가 "누가 내 계정을 쓰는 것 같다" 인데,
     *    남의 기기에 붙어 있던 세션이 그대로 살아 있으면 바꾼 의미가 없다.
     *    바꾼 본인도 다시 로그인해야 한다 — 지금 쓰는 기기의 토큰만 남길 수는 없다.
     *    리프레시 쿠키의 path 가 /api/auth 라 이 엔드포인트로는 쿠키가 오지 않아
     *    "어느 토큰이 나인지" 를 알 방법이 없기 때문이다.
     */
    @Transactional
    public void changePassword(Long userId, PasswordChangeRequest request) {
        User user = getUser(userId);

        if (!user.hasPassword()) {
            throw new BusinessException(UserErrorCode.SOCIAL_ACCOUNT_NO_PASSWORD);
        }

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BusinessException(UserErrorCode.PASSWORD_MISMATCH);
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BusinessException(UserErrorCode.SAME_PASSWORD);
        }

        user.changePassword(passwordEncoder.encode(request.newPassword()));
        authService.revokeAllSessions(userId);
    }

    /** 닉네임 변경 (API-105) */
    @Transactional
    public void changeNickname(Long userId, NicknameChangeRequest request) {
        User user = getUser(userId);

        if (user.getNickname().equals(request.nickname())) {
            throw new BusinessException(UserErrorCode.SAME_NICKNAME);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_NICKNAME);
        }

        user.changeNickname(request.nickname());
    }

    /**
     * 회원 탈퇴 (API-106).
     *
     * 소프트 삭제로 표시하고, 생체정보(얼굴 특징값)는 지연 없이 함께 파기한다.
     * 나머지 개인정보 파기는 보관 기간 정책이 정해지면 배치로 처리한다.
     *
     * 남아 있는 리프레시 토큰도 함께 지운다. 탈퇴한 회원은 조회되지 않아
     * 재발급이 어차피 막히지만, 쓸 수 없는 토큰을 Redis 에 남겨둘 이유가 없다.
     */
    @Transactional
    public void withdraw(Long userId) {
        getUser(userId).withdraw(LocalDateTime.now());
        authService.revokeAllSessions(userId);
    }

    /** 얼굴 정보 등록 (API-109) */
    @Transactional
    public void registerFace(Long userId, FaceRegisterRequest request) {
        User user = getUser(userId);

        if (user.hasFace()) {
            throw new BusinessException(UserErrorCode.FACE_ALREADY_REGISTERED);
        }
        if (request.embedding().length != Face.EMBEDDING_DIMENSION) {
            throw new BusinessException(UserErrorCode.INVALID_FACE_EMBEDDING);
        }

        user.registerFace(Face.of(request.embedding().clone(), request.modelVersion()));
    }

    /** 얼굴 정보 삭제 (API-110) */
    @Transactional
    public void deleteFace(Long userId) {
        User user = getUser(userId);

        if (!user.hasFace()) {
            throw new BusinessException(UserErrorCode.FACE_NOT_FOUND);
        }

        user.removeFace();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
    }
}
