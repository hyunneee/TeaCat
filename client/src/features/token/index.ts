/**
 * 캣머니(토큰).
 *
 * 잔액은 포카·예매·마이페이지가 **모두** 보는 값이라 어느 한 도메인에 얹지 않고
 * 독립 feature 로 둡니다. 잔액을 바꾸는 쪽(포카 거래·결제)은
 * `tokenKeys.balance()` 를 무효화하기만 하면 됩니다.
 *
 * 벌기(미니게임 등) 기획이 확정되면 여기에 `hooks/useMining` 을 추가하세요.
 */
export { useTokenBalance } from './hooks/useTokenBalance';
export { tokenApi, tokenKeys } from './api/tokenApi';
export type { TokenBalance } from './model/token.types';
