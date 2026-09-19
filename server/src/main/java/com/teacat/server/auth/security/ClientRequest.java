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

    private static String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            // "client, proxy1, proxy2" — 맨 앞이 실제 클라이언트다
            String first = forwarded.split(",")[0].trim();
            if (StringUtils.hasText(first)) {
                return normalizeIp(first);
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return normalizeIp(realIp.trim());
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
