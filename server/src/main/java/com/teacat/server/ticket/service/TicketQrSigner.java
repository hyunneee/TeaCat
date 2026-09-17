package com.teacat.server.ticket.service;

import com.teacat.server.auth.security.JwtProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.ticket.exception.TicketErrorCode;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * 티켓 QR 에 담을 <b>서명된 문자열</b>을 만들고 검증한다.
 *
 * <h3>왜 티켓 번호를 그냥 담지 않나</h3>
 * 티켓 id 는 순번이다. 그대로 담으면 아무 숫자나 QR 로 만들어 게이트에 들이대는 것만으로
 * <b>남의 예매 정보(이름·좌석)가 검표 화면에 뜬다.</b> 입장 자체는 얼굴에서 막히지만,
 * 그 전에 정보가 새는 것은 막아야 한다. 서명이 붙으면 우리가 만든 QR 만 읽힌다.
 *
 * <h3>🔴 왜 새 시크릿을 두지 않고 JWT 시크릿에서 <b>파생</b>하나</h3>
 * 설정에 {@code ticket.qr.secret: ${TICKET_QR_SECRET:기본값}} 을 두면, 운영에서 그 환경변수를
 * 빠뜨렸을 때 <b>저장소에 적힌 기본값으로 서명된다</b> — 누구나 QR 을 위조할 수 있고,
 * 아무 에러도 나지 않아 눈치채지 못한다. {@code JWT_SECRET} 은 없으면 로그인이 안 되므로
 * 운영에 반드시 채워져 있다. 거기서 <b>용도를 섞어 쓰지 않도록</b> 한 단계 파생해서 쓴다
 * (같은 키로 JWT 도 서명하고 QR 도 서명하면 한쪽의 약점이 다른 쪽으로 번진다).
 *
 * <h3>수명</h3>
 * 만료를 넣지 않았다. QR 은 공연장 입구에서 찍는데 거기는 보통 전파가 나쁘고, 30초짜리
 * 토큰이면 화면을 띄우는 동안 만료돼 들어가지 못한다. 대신 <b>한 번 입장하면 그 티켓은
 * 다시 쓸 수 없다</b>({@code tickets.checked_in_at}) — 스크린샷을 넘겨줘도 두 번째는 막힌다.
 */
@Component
public class TicketQrSigner {

    /** 형식이 바뀌면 올린다. 옛 QR 을 조용히 통과시키지 않기 위한 표식이다 */
    private static final String VERSION = "T1";
    private static final String SEPARATOR = ".";
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    /** 🔴 파생 문구. 이 값을 바꾸면 이미 발급된 QR 이 전부 무효가 된다 */
    private static final byte[] PURPOSE = "teacat:ticket-qr:v1".getBytes(StandardCharsets.UTF_8);

    private final SecretKeySpec key;

    public TicketQrSigner(JwtProperties jwtProperties) {
        byte[] root = jwtProperties.secret().getBytes(StandardCharsets.UTF_8);
        this.key = new SecretKeySpec(hmac(new SecretKeySpec(root, HMAC_ALGORITHM), PURPOSE), HMAC_ALGORITHM);
    }

    /** {@code T1.{ticketId}.{서명}} */
    public String sign(Long ticketId) {
        String payload = VERSION + SEPARATOR + ticketId;
        return payload + SEPARATOR + signatureOf(payload);
    }

    /**
     * 서명을 확인하고 티켓 id 를 꺼낸다.
     *
     * <p>🔴 <b>여기서는 티켓이 있는지 보지 않는다.</b> 서명이 맞는지만 본다 — 존재 여부는
     * 부르는 쪽이 판단하고, 어느 쪽이 틀렸는지는 사용자에게 구분해서 알려주지 않는다.
     *
     * @throws BusinessException 형식이 다르거나 서명이 맞지 않으면 {@code TICKET_005}
     */
    public Long verify(String token) {
        if (token == null) {
            throw new BusinessException(TicketErrorCode.TICKET_QR_INVALID);
        }

        String[] parts = token.trim().split("\\" + SEPARATOR);
        if (parts.length != 3 || !VERSION.equals(parts[0])) {
            throw new BusinessException(TicketErrorCode.TICKET_QR_INVALID);
        }

        String payload = parts[0] + SEPARATOR + parts[1];
        /* 🔴 equals 로 비교하지 않는다. 앞에서부터 한 바이트씩 끊는 비교는 걸리는 시간이
           일치한 길이에 비례해서, 반복 호출로 서명을 한 글자씩 맞춰 볼 수 있다. */
        if (!MessageDigest.isEqual(
                signatureOf(payload).getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(TicketErrorCode.TICKET_QR_INVALID);
        }

        try {
            return Long.valueOf(parts[1]);
        } catch (NumberFormatException e) {
            throw new BusinessException(TicketErrorCode.TICKET_QR_INVALID);
        }
    }

    private String signatureOf(String payload) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmac(key, payload.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] hmac(SecretKeySpec key, byte[] message) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(key);
            return mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            // 알고리즘은 JDK 표준이고 키도 우리가 만든 것이라, 여기 오면 설정이 깨진 것이다
            throw new IllegalStateException("티켓 QR 서명에 실패했습니다.", e);
        }
    }
}
