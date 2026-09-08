import { useCallback, useEffect, useRef } from 'react';

interface Options {
  /** 다음 페이지가 있는가 (`useInfiniteQuery().hasNextPage`) */
  hasNext: boolean;
  /** 지금 받고 있는가 (`isFetchingNextPage`). true 면 다시 부르지 않는다 */
  isFetching: boolean;
  /** 다음 페이지 요청 (`fetchNextPage`) */
  onLoadMore: () => void;
}

/**
 * 목록 끝의 **센티널 요소**가 보이면 다음 페이지를 부릅니다.
 *
 *   const sentinel = useInfiniteScroll({ hasNext, isFetching, onLoadMore: fetchNextPage });
 *   <ul>…</ul>
 *   <div ref={sentinel} aria-hidden className="h-px" />
 *
 * "더 보기" 버튼을 두지 않는 이유 — 버튼은 눌러야 하고, 스크롤은 이미 하고 있습니다.
 * 200px 먼저 부르므로 끝에 닿기 전에 다음 장이 채워집니다.
 *
 * 로딩이 끝났는데 센티널이 여전히 보이면(페이지가 짧아 한 번에 안 채워질 때)
 * IntersectionObserver 는 다시 알려주지 않습니다. 그래서 `isFetching` 이 false 로
 * 바뀌는 순간 위치를 한 번 직접 재서 필요하면 또 부릅니다.
 */
export function useInfiniteScroll({ hasNext, isFetching, onLoadMore }: Options) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  /* 최신 값을 ref 에 담아 옵저버 콜백이 stale 한 클로저를 보지 않게 합니다 */
  const latest = useRef({ hasNext, isFetching, onLoadMore });
  latest.current = { hasNext, isFetching, onLoadMore };

  const sentinel = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    nodeRef.current = node;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const state = latest.current;
        if (!entries.some((e) => e.isIntersecting)) return;
        if (state.hasNext && !state.isFetching) state.onLoadMore();
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  /* 로딩이 끝난 뒤에도 센티널이 화면 안이면 이어서 받습니다 */
  useEffect(() => {
    if (isFetching || !hasNext) return;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 200) onLoadMore();
  }, [isFetching, hasNext, onLoadMore]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return sentinel;
}
