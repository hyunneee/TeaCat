package com.teacat.server.user.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 회원.
 *
 * 탈퇴는 소프트 삭제(deleted_at)로 처리하며, {@link SQLRestriction} 덕분에 조회 시 자동으로 제외된다.
 */
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@SQLRestriction("deleted_at is null")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false)
    private String email;

    /** 소셜(SSAFY) 전용 계정은 비밀번호가 없다 */
    @Column(name = "password")
    private String password;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false, columnDefinition = "user_role")
    private UserRole role;

    /** 얼굴 미등록 상태에서도 회원가입이 가능하므로 null 이 될 수 있다. */
    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "face_id")
    private Face face;

    /**
     * 토스 결제창·결제위젯이 요구하는 고객 식별자. 같은 회원은 늘 같은 값이어야 한다.
     *
     * 회원 PK 를 쓰지 않는 이유는 두 가지다 — 이메일·전화번호처럼 <b>개인정보를 넣으면 안 되고</b>,
     * 순번이라 추측 가능해서도 안 된다. 첫 결제 때 만들어 넣으므로 null 일 수 있다.
     */
    @Column(name = "payment_customer_key", columnDefinition = "uuid")
    private UUID paymentCustomerKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    private User(String email, String password, String name, String nickname, String phone, UserRole role) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.nickname = nickname;
        this.phone = phone;
        this.role = role;
    }

    /** 가입 (API-101). password 는 반드시 인코딩된 값을 넘긴다. */
    public static User create(String email, String encodedPassword, String name, String nickname, String phone) {
        return new User(email, encodedPassword, name, nickname, phone, UserRole.USER);
    }

    /** SSAFY 등 외부 계정으로 가입 (비밀번호 없음) */
    public static User createSocial(String email, String name, String nickname, String phone) {
        return new User(email, null, name, nickname, phone, UserRole.USER);
    }

    /** 비밀번호 변경 (API-104) */
    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    /** 닉네임 변경 (API-105) */
    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    /** 얼굴 정보 등록 (API-109) */
    public void registerFace(Face face) {
        this.face = face;
    }

    /** 얼굴 정보 삭제 (API-110). orphanRemoval 로 faces 행까지 함께 지워진다. */
    public void removeFace() {
        this.face = null;
    }

    /** 비밀번호로 로그인할 수 있는 계정인가 (소셜 전용 계정은 false) */
    public boolean hasPassword() {
        return this.password != null;
    }

    /**
     * 결제용 고객 식별자를 발급한다. 이미 있으면 그대로 쓴다 — 회원마다 <b>고정</b>이어야
     * 토스 쪽에서 같은 고객으로 묶인다.
     */
    public UUID issuePaymentCustomerKey() {
        if (this.paymentCustomerKey == null) {
            this.paymentCustomerKey = UUID.randomUUID();
        }
        return this.paymentCustomerKey;
    }

    public boolean hasFace() {
        return this.face != null;
    }

    /** 회원 탈퇴 (API-106). 생체정보는 지연 없이 파기하고, 나머지 개인정보는 파기 절차 대상으로 남긴다. */
    public void withdraw(LocalDateTime withdrawnAt) {
        this.deletedAt = withdrawnAt;
        removeFace();
    }
}
