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

    /**
     * 관리자가 직접 만드는 회원. 역할을 지정할 수 있다.
     *
     * 일반 가입({@link #create})은 항상 USER 다 — 역할을 요청 본문으로 받으면
     * 누구나 스스로 ADMIN 으로 가입할 수 있게 된다.
     */
    public static User createWithRole(String email, String encodedPassword, String name,
                                      String nickname, String phone, UserRole role) {
        return new User(email, encodedPassword, name, nickname, phone, role);
    }

    /** 비밀번호 변경 (API-104) */
    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    /** 닉네임 변경 (API-105) */
    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    /** 이름 변경 — 관리자만 바꾼다. 입장 시 신분 확인에 쓰는 값이라 본인은 수정할 수 없다 */
    public void changeName(String name) {
        this.name = name;
    }

    /** 휴대폰 번호 변경 */
    public void changePhone(String phone) {
        this.phone = phone;
    }

    /**
     * 역할 변경 — 관리자만.
     *
     * ⚠️ 액세스 토큰에 역할이 담겨 있다. 바꾼 뒤에는 그 회원의 세션을 끊어야
     *    옛 역할로 만든 토큰이 남지 않는다 (AdminUserService 가 처리한다).
     */
    public void changeRole(UserRole role) {
        this.role = role;
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

    /**
     * 회원 탈퇴 (API-106). 생체정보는 지연 없이 파기하고, 나머지 개인정보는 파기 절차 대상으로 남긴다.
     *
     * <p>🔴 <b>여기서 지우는 것은 `faces` 행 하나뿐이다.</b> 티켓이 예매 당시 얼굴을 <b>베껴</b>
     * 갖고 있으므로({@code tickets.face_embedding}), 그 복사본은 부르는 쪽이 함께 지워야 한다 —
     * {@code TicketRepository.eraseFaceOf(userId)}. 엔티티는 리포지토리를 모르니 여기서 할 수 없다.
     * 탈퇴 경로는 두 곳이다({@code UserService}·{@code AdminUserService}) — 한쪽만 고치지 마세요.
     */
    public void withdraw(LocalDateTime withdrawnAt) {
        this.deletedAt = withdrawnAt;
        removeFace();
    }
}
