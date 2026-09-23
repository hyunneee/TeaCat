/** 같이 하는 게임의 서버 응답 모양. 서버 DTO 와 1:1 입니다. */

export type GameType = 'YUT' | 'HALLI_GALLI';

export type GameRoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED' | 'ABORTED';

export type GameParticipantStatus = 'JOINED' | 'PLAYING' | 'RETIRED' | 'FINISHED';

/** 말 모양. 한 방에서 겹치지 않습니다 */
export type GamePieceStyle = 'CAT' | 'DOG' | 'RABBIT' | 'BIRD' | 'FISH' | 'TURTLE';

export interface GameParticipant {
  seatNo: number;
  nickname: string;
  host: boolean;
  me: boolean;
  ready: boolean;
  /** 고른 말 모양. 들어오는 순간 남은 것 하나가 자동으로 채워집니다 */
  pieceStyle: GamePieceStyle | null;
  status: GameParticipantStatus;
  /** 정산 전에는 null */
  rank: number | null;
  payout: number | null;
}

/**
 * 윷놀이 게임판.
 *
 * `pieces[자리][말]` 이 칸 번호입니다 — `-1` 은 아직 판에 오르지 않은 말, `29` 는 완주입니다.
 * 칸 배치는 `model/yutBoard.ts` 가 화면 좌표로 옮깁니다.
 */
export interface YutState {
  turn: number;
  players: number;
  /** 이 판에서 한 사람이 쓰는 말 수. 방을 만들 때 정합니다 */
  piecesPerPlayer: number;
  pieces: number[][];
  /**
   * 방금 던져 나온 값.
   *
   * 🔴 `pending` 으로는 알 수 없습니다 — 도가 나오자마자 말을 옮기면 `pending` 이 비어
   * 화면에 아무것도 안 남습니다. 화면 한가운데에 크게 띄워 **다른 사람도 보게** 하려고
   * 서버가 따로 남겨 줍니다.
   */
  lastThrow: number | null;
  lastThrowSeat: number | null;
  /** 던질 때마다 하나씩 오릅니다. 같은 값이 연달아 나와도 새 던지기로 알아봅니다 */
  throwSeq: number;
  /** 던질 수 있나. 윷·모가 나오거나 말을 잡으면 다시 true 가 됩니다 */
  canThrow: boolean;
  /** 던져 놓고 아직 안 쓴 결과들. 윷이 연달아 나오면 여러 개가 쌓입니다 */
  pending: number[];
  retired: boolean[];
  /** 말을 모두 뺀 순서. 이게 곧 등수입니다 */
  finishOrder: number[];
  log: string[];
  finished: boolean;
}

export interface HalliGalliCard {
  fruit: 'CHERRY' | 'BANANA' | 'LIME' | 'GRAPE';
  count: number;
}

/**
 * 할리갈리 게임판.
 *
 * 🔴 엎어 둔 카드(`hands`)는 **오지 않습니다.** 본인 것이라도 알면 종을 언제 칠지 미리
 * 계산할 수 있어서 서버가 지우고 장수(`handCounts`)만 내려줍니다.
 */
export interface HalliGalliState {
  turn: number;
  players: number;
  /** 각자 펼쳐 놓은 더미. `[0]` 이 지금 보이는 카드입니다 */
  piles: HalliGalliCard[][];
  handCounts: number[];
  eliminated: boolean[];
  eliminationOrder: number[];
  lastBellSeat: number | null;
  lastBellCorrect: boolean | null;
  log: string[];
  finished: boolean;
}

export type GameState = YutState | HalliGalliState;

export interface GameRoom {
  roomId: number;
  inviteCode: string;
  gameType: GameType;
  status: GameRoomStatus;
  betAmount: number;
  maxPlayers: number;
  /** 1인당 말 수 (윷놀이) */
  piecesPerPlayer: number;
  mySeatNo: number;
  host: boolean;
  participants: GameParticipant[];
  /** 대기실에서는 null 입니다 */
  state: GameState | null;
  turnExpiresAt: string | null;
  prizePool: number;
  subsidy: number;
}

export interface GamePolicy {
  /** 고를 수 있는 판돈. `0` 은 연습 모드입니다 */
  betChoices: number[];
  subsidyPerPlayer: number;
  /** 오늘 내가 아직 받을 수 있는 보조금 */
  remainingSubsidyToday: number;
  /** 인원수별 등수 배분 비율(%). 인덱스 = 인원수 − 1 */
  prizeShares: number[][];
}

export interface CreateGameRoomRequest {
  gameType: GameType;
  betAmount: number;
  maxPlayers: number;
  /** 1인당 말 수 1~4. 윷놀이만 씁니다 */
  piecesPerPlayer?: number;
}

export interface GameActionRequest {
  action: 'THROW' | 'MOVE' | 'FLIP' | 'BELL';
  piece?: number;
  value?: number;
}
