package com.teacat.server.common;

import com.teacat.server.banner.dto.request.BannerWriteRequest;
import com.teacat.server.performance.dto.request.ConcertCreateRequest;
import com.teacat.server.performance.dto.request.ConcertUpdateRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 관리자가 적어 넣는 바로가기 주소 규칙.
 *
 * <p>같은 규칙이 <b>세 군데</b>에 적혀 있다 — 배너, 공연 등록, 공연 수정. 여기서 지키려는
 * 것은 <b>셋이 같은 답을 내는가</b>다. 하나만 느슨해지면 그 입구로 무엇이든 들어온다.
 *
 * <p>🔴 <b>가장 중요한 줄은 {@code javascript:} 다.</b> 그 주소가 저장되면 화면이
 * {@code href}·{@code window.open} 에 그대로 실어 <b>우리 페이지 안에서 그 코드를 돌린다</b> —
 * 관리자만 쓰는 화면이라도 관리자 계정 하나가 뚫리면 모든 방문자에게 실행된다.
 *
 * <p>client 쪽 같은 규칙은 {@code shared/lib/link.ts} 에 있다. 한쪽만 고치면 화면은
 * 통과시키는데 서버가 400 을 내거나 그 반대가 된다.
 */
class LinkPatternTests {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    /* ── 받아야 하는 것 ──────────────────────────────────────── */

    @ParameterizedTest
    @ValueSource(strings = {
            "/nft",
            "/nft/draw",
            "/concerts/12?tab=schedule",
            "http://example.com",
            "https://example.com",
            "https://example.com/event?utm_source=teacat&utm_medium=banner",
            "https://한글.도메인/행사",
    })
    void 서비스_내_경로와_http_주소는_받는다(String link) {
        assertThat(violations(link)).isEmpty();
    }

    /* ── 막아야 하는 것 ──────────────────────────────────────── */

    /**
     * 🔴 {@code javascript:} · {@code data:} 는 우리 페이지 안에서 코드가 돈다.
     *
     * <p>{@code //evil.com} 은 경로처럼 보이지만 "지금 프로토콜 그대로 저 도메인" 이라
     * 바깥으로 나간다. {@code https:/} (슬래시 하나)처럼 오타로 깨진 주소도 막는다 —
     * 브라우저마다 다르게 해석해서 어디로 갈지 우리가 알 수 없다.
     */
    @ParameterizedTest
    @ValueSource(strings = {
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            "vbscript:msgbox(1)",
            "//evil.com",
            "///evil.com",
            "ftp://example.com",
            "example.com",
            "nft/draw",
            "https:/example.com",
            "/nft draw",
            " /nft",
    })
    void 다른_스킴과_프로토콜_상대_주소는_막는다(String link) {
        assertThat(violations(link)).isNotEmpty();
    }

    /* ── null 과 빈 문자열 ──────────────────────────────────── */

    /** 바로가기는 선택이다. 안 보내면(null) "없음" 이고, 세 DTO 모두 통과시킨다 */
    @Test
    void 안_보내면_통과한다() {
        assertThat(violations(null)).isEmpty();
    }

    /**
     * 🔴 <b>수정 요청만 빈 문자열을 받는다.</b> 그게 "바로가기 떼기" 다 —
     * "안 보냄(null) = 그대로" 규칙이라 빈 문자열까지 막으면 한 번 붙인 바로가기를
     * 영영 못 뗀다. 등록에는 뗄 것이 없으므로 받지 않는다.
     */
    @Test
    void 빈_문자열은_수정에서만_받는다() {
        assertThat(validator.validateValue(ConcertUpdateRequest.class, "linkUrl", "")).isEmpty();
        assertThat(validator.validateValue(ConcertCreateRequest.class, "linkUrl", "")).isNotEmpty();
        assertThat(validator.validateValue(BannerWriteRequest.class, "linkPath", "")).isNotEmpty();
    }

    /* ── 도우미 ──────────────────────────────────────────────── */

    /** 세 DTO 를 한 번에 물어본다. 답이 갈리면 그 자체가 버그다 */
    private static java.util.Set<?> violations(String link) {
        var banner = validator.validateValue(BannerWriteRequest.class, "linkPath", link);
        var create = validator.validateValue(ConcertCreateRequest.class, "linkUrl", link);
        var update = validator.validateValue(ConcertUpdateRequest.class, "linkUrl", link);

        assertThat(banner.isEmpty())
                .as("배너와 공연 등록의 규칙이 다릅니다: %s", link)
                .isEqualTo(create.isEmpty());
        // 수정은 빈 문자열만 더 받으므로 그 경우를 뺀 나머지가 같아야 한다
        if (link != null && !link.isEmpty()) {
            assertThat(create.isEmpty())
                    .as("공연 등록과 수정의 규칙이 다릅니다: %s", link)
                    .isEqualTo(update.isEmpty());
        }

        return banner;
    }
}
