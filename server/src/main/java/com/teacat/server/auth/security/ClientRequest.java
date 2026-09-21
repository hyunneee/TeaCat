package com.teacat.server.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 요청을 보낸 단말의 식별 정보. 이상거래 심사(부계정·계정 탈취 판별)와 로그인 단말 기록에 쓴다.
 *
 * <p>요청은 nginx 를 거쳐 오므로 {@code getRemoteAddr()} 은 모든 사용자에게 nginx 컨테이너 주소 하나다.
 * 진짜 주소는 nginx 가 넣는 {@code X-Forwarded-For} 의 첫 값에 있다. 전역 {@code ForwardedHeaderFilter}
 * 를 등록하지 않고 여기서만 읽는 이유는 두 가지다 — SecurityConfig 인접 설정을 건드리지 않고,
 * 시뮬레이터가 nginx 를 우회해 서버를 직접 칠 때 헤더로 단말을 지정할 수 있어야 한다.
 *
 * <p>User-Agent 는 원문을 저장하지 않는다. SHA-256 해시만 갖는다 — "같은 브라우저인가" 만 알면 된다.
 *
 * @param ip            요청 IP. 알 수 없으면 null
 * @param userAgentHash User-Agent 의 SHA-256 hex(64자). 헤더가 없으면 null
 */
public record ClientRequest(String ip, String userAgentHash) {

    private static final ClientRequest UNKNOWN = new ClientRequest(null, null);
    private static final int MAX_IP_LENGTH = 45;

    public static ClientRequest unknown() {
        return UNKNOWN;
    }

    public static ClientRequest from(HttpServletRequest request) {
        if (request == null) {
            return UNKNOWN;
        }
        return new ClientRequest(resolveIp(request), hash(request.getHeader("User-Agent")));
    }

    public static ClientRequest of(String ip, String userAgent) {
        return new ClientRequest(normalizeIp(ip), hash(userAgent));
    }

    public boolean isKnown() {
        return ip != null || userAgentHash != null;
    }

    /**
     * 🔴 <b>X-Real-IP 를 먼저 본다.</b> nginx 가 {@code proxy_set_header X-Real-IP $remote_addr} 로 <b>항상 덮어쓰므로</b>
     * 클라이언트가 위조할 수 없다. 반면 {@code X-Forwarded-For} 는 {@code $proxy_add_x_forwarded_for} 가
     * <b>클라이언트가 보낸 값 뒤에 실제 IP 를 이어붙이는</b> 구조라, 맨 앞 값은 사용자가 마음대로 넣을 수 있다.
     * 그 값을 믿으면 매 요청마다 다른 IP 를 위조해 동일 단말 규칙(R1)을 그냥 빠져나간다.
     *
     * <p>X-Forwarded-For 는 nginx 를 거치지 않는 경로(로컬 개발·시뮬레이터)에서만 폴백으로 쓴다.
     */
    private static String resolveIp(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return normalizeIp(realIp.trim());
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            // "client, proxy1, proxy2" — 맨 앞이 클라이언트가 주장하는 주소다
            String first = forwarded.split(",")[0].trim();
            if (StringUtils.hasText(first)) {
                return normalizeIp(first);
            }
        }
        return normalizeIp(request.getRemoteAddr());
    }

    private static String normalizeIp(String ip) {
        if (!StringUtils.hasText(ip)) {
            return null;
        }
        String trimmed = ip.trim();
        return trimmed.length() > MAX_IP_LENGTH ? trimmed.substring(0, MAX_IP_LENGTH) : trimmed;
    }

    static String hash(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(userAgent.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 지원하지 않는 JVM 입니다", e);
        }
    }
}
