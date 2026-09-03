package com.teacat.server.auth.dto.response;

/**
 * SSAFY 로그인 시작에 필요한 값을 컨트롤러로 넘기는 내부 전달용 타입.
 *
 * state 는 주소에도 실리고 쿠키에도 심긴다. SSAFY 가 state 를 돌려주지 않아도
 * 쿠키 쪽으로 검증할 수 있게 하기 위해서다. 이 타입 자체는 직렬화되지 않는다.
 */
public record AuthorizationRedirect(String uri, String state) {
}
