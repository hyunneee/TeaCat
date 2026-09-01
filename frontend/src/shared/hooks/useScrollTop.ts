import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 화면이 바뀌면 **맨 위에서 시작**합니다.
 *
 * 브라우저는 문서 스크롤 위치를 그대로 두기 때문에, 공연 목록을 한참 내려간 뒤
 * 하단 탭으로 포카 마켓에 가면 그 화면도 중간부터 보입니다.
 * 헤더·검색 바가 sticky 라 더 헷갈립니다 — 목록만 잘려 보이니 "로딩이 덜 됐나" 싶습니다.
 *
 * ⚠️ **뒤로가기(POP)는 건드리지 않습니다.** 목록 → 상세 → 뒤로 왔을 때
 *    보고 있던 자리로 돌아가야 하고, 그건 브라우저가 이미 해 줍니다.
 *    여기서 0 으로 밀면 한참 내려가 고른 카드를 매번 다시 찾아야 합니다.
 *
 * 같은 경로 안에서 쿼리만 바뀌는 경우(`/concerts?q=...`)도 그대로 둡니다.
 * 검색어를 고치는 중에 화면이 위로 튀면 입력이 방해받습니다.
 */
export function useScrollTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    /* 부드러운 스크롤을 쓰지 않습니다 — 새 화면이 이미 페이드로 들어오는 중이라
       거기에 스크롤 애니메이션이 겹치면 화면이 두 번 움직이는 것처럼 보입니다. */
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
}
