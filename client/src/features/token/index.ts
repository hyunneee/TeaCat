/**
 * 캣머니(토큰).
 *
 * 잔액은 포카·예매·마이페이지가 **모두** 보는 값이라 어느 한 도메인에 얹지 않고
 * 독립 feature 로 둡니다. 잔액을 바꾸는 쪽(포카 거래·결제)은
 * `tokenKeys.balance()` 를 무효화하기만 하면 됩니다.
 *
 * 벌기(미니게임)는 `hooks/useMemoryGame` + `components/Memory*` 입니다.
 * 🔴 아직 **보상을 지급하지 않습니다** — 클리어 등급만 보여줍니다
 * (`model/memoryGame.model` 의 `REWARD_TIERS` 주석).
 */
export { useTokenBalance } from './hooks/useTokenBalance';
export { tokenApi, tokenKeys } from './api/tokenApi';
export type { TokenBalance } from './model/token.types';

export { useMemoryGame, type MemoryGame } from './hooks/useMemoryGame';
export { MemoryBoard } from './components/MemoryBoard';
export { MemoryHud } from './components/MemoryHud';
export { MemoryIntro } from './components/MemoryIntro';
export { MemoryClearModal } from './components/MemoryClearModal';
export { PAIR_COUNT, REWARD_TIERS, rewardFor, type MemoryStatus } from './model/memoryGame.model';
