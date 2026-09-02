import { useEffect, useState } from 'react';

/**
 * 값이 **잠잠해진 뒤에** 바뀌는 사본을 돌려줍니다. (검색 입력 → 조회)
 *
 * 글자를 칠 때마다 조회하면 "콘서트" 다섯 글자에 요청이 다섯 번 나가고,
 * 응답 순서가 뒤바뀌면 이전 키워드의 결과가 화면에 남습니다.
 * 입력 자체는 즉시 반응해야 하므로(커서·글자) 원본은 그대로 두고
 * **조회에 쓰는 값만** 늦춥니다.
 *
 * delay 를 400ms 이상 주면 "안 되는 건가?" 싶어집니다. 250ms 안쪽으로.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
