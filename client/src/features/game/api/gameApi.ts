import { http } from '@/shared/api';
import type {
  CreateGameRoomRequest,
  GameActionRequest,
  GamePolicy,
  GameRoom,
} from '../model/game.types';

export const gameApi = {
  /** 방을 만들기 전에 보여줄 값들 — 고를 수 있는 판돈, 보조금, 등수별 배분 비율 */
  policy: () => http.get<GamePolicy>('/games/policy'),

  /**
   * 앱을 다시 켰을 때 돌아갈 방.
   *
   * 🔴 참여 중인 방이 없으면 서버가 메시지만 주고 `data` 를 비웁니다. 그대로 돌려주면
   * TanStack Query 가 `undefined` 를 거절해서(*Query data cannot be undefined*) 쿼리가
   * 에러가 되고 화면이 로딩에서 멈춥니다. **`null` 로 바꿔서 "없음" 을 값으로 만듭니다.**
   */
  myRoom: () =>
    http.get<GameRoom | undefined>('/games/rooms/me').then((room) => room ?? null),

  create: (body: CreateGameRoomRequest) => http.post<GameRoom>('/games/rooms', body),

  join: (inviteCode: string) => http.post<GameRoom>('/games/rooms/join', { inviteCode }),

  room: (roomId: number) => http.get<GameRoom>(`/games/rooms/${roomId}`),

  ready: (roomId: number, ready: boolean) =>
    http.patch<GameRoom>(`/games/rooms/${roomId}/ready`, { ready }),

  start: (roomId: number) => http.post<GameRoom>(`/games/rooms/${roomId}/start`, {}),

  /**
   * 게임 안에서 하는 행동.
   *
   * 🔴 멱등 키를 붙이지 않습니다. 같은 행동을 두 번 하는 것이 **정상**이기 때문입니다 —
   * 윷은 계속 던지고, 할리갈리는 계속 뒤집습니다. 중복 실행이 걱정되는 쪽은 서버가
   * 방 행을 잠그고 규칙으로 거르므로(차례가 아니면 거절) 여기서 막을 것이 없습니다.
   */
  act: (roomId: number, body: GameActionRequest) =>
    http.post<GameRoom>(`/games/rooms/${roomId}/actions`, body),

  leave: (roomId: number) => http.post<void>(`/games/rooms/${roomId}/leave`, {}),
};

export const gameKeys = {
  all: ['game'] as const,
  policy: () => [...gameKeys.all, 'policy'] as const,
  myRoom: () => [...gameKeys.all, 'myRoom'] as const,
  room: (roomId: number) => [...gameKeys.all, 'room', roomId] as const,
};
