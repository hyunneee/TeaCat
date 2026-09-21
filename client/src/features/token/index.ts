/**
 * 캣머니(토큰).
 *
 * 잔액은 포카·예매·마이페이지가 **모두** 보는 값이라 어느 한 도메인에 얹지 않고
 * 독립 feature 로 둡니다. 잔액을 바꾸는 쪽(포카 거래·결제)은
 * `tokenKeys.balance()` 를 무효화하기만 하면 됩니다.
 *
 * 벌기는 둘입니다.
 * - **출석 체크 · 송편 잡기** — `hooks/useDailyRewards` + `hooks/useSongpyeon*`.
 *   하루 한 번 실제로 캣머니가 들어옵니다. 🔴 금액도 "오늘 받았는지" 도 **서버**가 정합니다
 *   (`model/dailyReward.types` 주석).
 * - **포토카드 짝 맞추기** — `hooks/useMemoryGame` + `components/Memory*`.
 *   🔴 아직 **보상을 지급하지 않습니다** — 클리어 등급만 보여줍니다
 *   (`model/memoryGame.model` 의 `REWARD_TIERS` 주석).
 */
export { useTokenBalance } from './hooks/useTokenBalance';
export { tokenApi, tokenKeys } from './api/tokenApi';
export type { TokenBalance } from './model/token.types';

/* ── 하루 한 번 보상 (출석 체크 · 송편 잡기) ── */
export {
  useAttendance,
  useClaimSongpyeon,
  useDailyRewards,
  isAlreadyClaimed,
  type DailyRewards,
} from './hooks/useDailyRewards';
export {
  useSongpyeonChallenge,
  type SongpyeonChallenge,
} from './hooks/useSongpyeonChallenge';
export { useSongpyeonGame, type SongpyeonGame } from './hooks/useSongpyeonGame';
export { AttendanceCard } from './components/AttendanceCard';
export { SongpyeonBoard } from './components/SongpyeonBoard';
export { SongpyeonClearModal } from './components/SongpyeonClearModal';
export { SongpyeonHud } from './components/SongpyeonHud';
export { SongpyeonIntro } from './components/SongpyeonIntro';
export { SongpyeonPiece } from './components/SongpyeonPiece';
export {
  failMessage,
  STAGE_COUNT,
  STAGE_MS,
  STAGES,
  type FailReason,
  type Piece,
  type PieceKind,
  type SongpyeonStatus,
} from './model/songpyeonGame.model';
export {
  REWARD_ERROR,
  type DailyRewardStatus,
  type RewardClaimResult,
  type RewardState,
  type RewardType,
} from './model/dailyReward.types';

/* ── 포토카드 짝 맞추기 ── */
export { useMemoryGame, type MemoryGame } from './hooks/useMemoryGame';
export { useMemoryArt, type MemoryArt } from './hooks/useMemoryArt';
export { MemoryBoard } from './components/MemoryBoard';
export { MemoryHud } from './components/MemoryHud';
export { MemoryIntro } from './components/MemoryIntro';
export { MemoryClearModal } from './components/MemoryClearModal';
export {
  PAIR_COUNT,
  REWARD_TIERS,
  pickDeckArt,
  rewardFor,
  type ArtCandidate,
  type DeckArt,
  type MemoryStatus,
} from './model/memoryGame.model';
