package com.teacat.server.auth.dto.response;

/**
 * SSAFY 콜백 처리 결과를 컨트롤러로 넘기는 내부 전달용 타입.
 *
 * 둘 중 하나만 값이 있다. 이미 회원이면 토큰이, 처음이면 가입 티켓이 들어 있다.
 * 이 타입 자체는 직렬화되지 않는다. ({@link TokenPair} 참고)
 */
public record OauthCallbackResult(TokenPair tokens, String signupTicket) {

    public static OauthCallbackResult loggedIn(TokenPair tokens) {
        return new OauthCallbackResult(tokens, null);
    }

    public static OauthCallbackResult signupRequired(String signupTicket) {
        return new OauthCallbackResult(null, signupTicket);
    }

    public boolean needsSignup() {
        return signupTicket != null;
    }
}
