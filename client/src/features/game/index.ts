/**
 * 같이 하는 게임 (윷놀이 · 할리갈리).
 *
 * 초대 코드로 모여서 캣머니를 걸고, 등수별로 상금을 나눠 갖습니다. 상금은 참가자들이 낸
 * 판돈에 티캣이 인원수만큼 얹어준 보조금을 더한 금액입니다.
 *
 * 🔴 **금액도 등수도 서버가 정합니다.** 여기서 계산하지 마세요 — 화면이 계산하면 서버와
 * 어긋나는 순간 "받은 줄 알았는데 안 들어온" 상태가 됩니다. 판돈·보조금·배분 비율은
 * `useGamePolicy()` 로 받아서 그대로 보여주기만 합니다.
 *
 * 🔴 **게임판의 진실도 서버입니다.** 클라이언트는 받은 상태를 그리고 행동을 보낼 뿐이라
 * 낙관적 업데이트를 하지 않습니다. 할리갈리의 종은 "누가 먼저 눌렀나" 가 곧 승부라서,
 * 화면이 먼저 성공한 척하면 서버 판정과 어긋난 결과를 보여주게 됩니다.
 */
export { gameApi, gameKeys } from './api/gameApi';

export {
  useGamePolicy,
  useMyGameRoom,
  useGameRoom,
  useCreateGameRoom,
  useJoinGameRoom,
  useGameReady,
  useStartGame,
  useGameAction,
  useLeaveGameRoom,
} from './hooks/useGameRoom';

export { GameLobbyPanel } from './components/GameLobbyPanel';
export { GameResultCard } from './components/GameResultCard';
export { YutPanel } from './components/YutPanel';
export { HalliGalliPanel } from './components/HalliGalliPanel';

export type {
  GameType,
  GameRoom,
  GameRoomStatus,
  GameParticipant,
  GameParticipantStatus,
  GamePolicy,
  GameState,
  YutState,
  HalliGalliState,
  HalliGalliCard,
  CreateGameRoomRequest,
  GameActionRequest,
} from './model/game.types';
