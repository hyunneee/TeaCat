package com.teacat.server.auth.dto.response;

import com.teacat.server.user.dto.response.MyInfoResponse;

/**
 * 로그인 결과를 컨트롤러로 넘기는 내부 전달용 타입.
 *
 * 토큰 중 리프레시 토큰만 쿠키로 빠지기 때문에 바디에 담을 것과 분리해서 들고 나온다.
 * 이 타입 자체는 직렬화되지 않는다. ({@link TokenPair} 참고)
 */
public record LoginResult(TokenPair tokens, MyInfoResponse user) {
}
