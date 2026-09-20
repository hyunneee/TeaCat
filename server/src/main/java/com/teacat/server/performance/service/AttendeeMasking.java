package com.teacat.server.performance.service;

/**
 * 운영 화면에 내려보내는 예매자 개인정보를 가린다.
 *
 * <p>운영자가 명단에서 해야 하는 일은 <b>맞는 사람인지 확인</b>하는 것이다. 이름과 전화번호를
 * 통째로 내려주면 화면을 캡처하거나 훑는 것만으로 명부가 만들어지고, 그건 좌석 운영에 필요한
 * 범위를 넘는다. 그래서 <b>본인 확인에 쓸 만큼만</b> 남기고 가린다.
 *
 * <p>🔴 <b>가리는 일은 서버가 한다.</b> 원본을 내려보내고 화면에서 가리면 네트워크 응답에는
 * 원본이 그대로 남는다. 그 응답은 브라우저 개발자도구·프록시·행동 분석 도구에도 남는다.
 *
 * <p>닉네임은 가리지 않는다 — 서비스 안에서 이미 공개되는 표시 이름이다.
 */
final class AttendeeMasking {

    private AttendeeMasking() {
    }

    /**
     * 이름 — 처음과 끝 글자만 남긴다. {@code 홍길동 → 홍*동}, {@code 김철수민 → 김**민}.
     *
     * <p>두 글자는 {@code 김*}, 한 글자는 {@code *} 다. 두 글자에서 끝 글자를 남기면
     * 성만 가린 셈이라 오히려 이름이 드러난다.
     */
    static String name(String name) {
        if (name == null || name.isBlank()) return null;

        String trimmed = name.trim();
        return switch (trimmed.length()) {
            case 1 -> "*";
            case 2 -> trimmed.charAt(0) + "*";
            default -> trimmed.charAt(0)
                    + "*".repeat(trimmed.length() - 2)
                    + trimmed.charAt(trimmed.length() - 1);
        };
    }

    /**
     * 전화번호 — 가운데를 가린다. {@code 01012345678 → 010-****-5678}.
     *
     * <p>뒤 네 자리는 남긴다. 게이트에서 "뒷번호 5678 맞으세요?" 로 확인하는 값이라,
     * 여기까지 가리면 명단으로 사람을 확인할 수 없다.
     *
     * <p>숫자만 뽑아 판단한다 — 저장된 값에 하이픈이 섞여 있어도 결과가 같아야 한다.
     * 형식이 예상과 다르면(길이 부족) <b>끝 네 자리만</b> 남기고 나머지를 가린다.
     */
    static String phone(String phone) {
        if (phone == null || phone.isBlank()) return null;

        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 8) return "*".repeat(Math.max(digits.length(), 1));

        String head = digits.substring(0, digits.length() >= 10 ? 3 : 2);
        String tail = digits.substring(digits.length() - 4);
        int hidden = digits.length() - head.length() - tail.length();

        return head + "-" + "*".repeat(hidden) + "-" + tail;
    }
}
