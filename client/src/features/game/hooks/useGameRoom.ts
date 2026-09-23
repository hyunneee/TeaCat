import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '@/shared/api';
import type { ApiError } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { ROUTES } from '@/shared/constants/routes';
import { toast } from '@/shared/stores';
import { tokenKeys } from '@/features/token';
import { gameApi, gameKeys } from '../api/gameApi';
import type { CreateGameRoomRequest, GameActionRequest, GamePieceStyle } from '../model/game.types';
import { useGameEvents } from './useGameEvents';

/**
 * SSE 가 끊겼을 때만 쓰는 예비 폴링 주기.
 *
 * 평소에는 서버가 밀어주므로 다시 묻지 않습니다. 끊긴 동안에도 판이 멈춰 보이면 안 되니
 * (차례가 넘어온 것을 모르고 기다립니다) 그때만 짧게 돕니다.
 */
const FALLBACK_POLL_MS = 2_000;

export function useGamePolicy() {
  return useQuery({
    queryKey: gameKeys.policy(),
    queryFn: gameApi.policy,
    staleTime: STALE_TIME.SHORT,
  });
}

/** 지금 들어가 있는 방. 없으면 undefined */
export function useMyGameRoom() {
  return useQuery({
    queryKey: gameKeys.myRoom(),
    queryFn: gameApi.myRoom,
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * 방 하나를 보면서 서버 알림을 듣습니다.
 *
 * 알림이 오면 캐시를 무효화하기만 합니다 — 이벤트에 게임판이 실려 있지 않기 때문입니다
 * ({@link useGameEvents} 주석).
 */
export function useGameRoom(roomId: number | undefined) {
  const { connected } = useGameEvents(
    roomId,
    useCallback(() => {
      if (roomId) void queryClient.invalidateQueries({ queryKey: gameKeys.room(roomId) });
    }, [roomId]),
  );

  const query = useQuery({
    queryKey: gameKeys.room(roomId ?? 0),
    queryFn: () => gameApi.room(roomId!),
    enabled: !!roomId,
    // SSE 가 살아 있으면 폴링하지 않습니다
    refetchInterval: connected ? false : FALLBACK_POLL_MS,
  });

  return { ...query, connected };
}

export function useCreateGameRoom() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: CreateGameRoomRequest) => gameApi.create(body),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: gameKeys.myRoom() });
      void navigate(ROUTES.GAME_ROOM.replace(':roomId', String(room.roomId)));
    },
    onError: (error: ApiError) => toast.error(error.message),
  });
}

export function useJoinGameRoom() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (inviteCode: string) => gameApi.join(inviteCode.trim().toUpperCase()),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: gameKeys.myRoom() });
      void navigate(ROUTES.GAME_ROOM.replace(':roomId', String(room.roomId)));
    },
    onError: (error: ApiError) => toast.error(error.message),
  });
}

export function useGameReady(roomId: number) {
  return useMutation({
    mutationFn: (ready: boolean) => gameApi.ready(roomId, ready),
    onSuccess: (room) => queryClient.setQueryData(gameKeys.room(roomId), room),
    onError: (error: ApiError) => toast.error(error.message),
  });
}

export function usePickPieceStyle(roomId: number) {
  return useMutation({
    mutationFn: (style: GamePieceStyle) => gameApi.pieceStyle(roomId, style),
    onSuccess: (room) => queryClient.setQueryData(gameKeys.room(roomId), room),
    onError: (error: ApiError) => toast.error(error.message),
  });
}

export function useStartGame(roomId: number) {
  return useMutation({
    mutationFn: () => gameApi.start(roomId),
    onSuccess: (room) => queryClient.setQueryData(gameKeys.room(roomId), room),
    onError: (error: ApiError) => toast.error(error.message),
  });
}

export function useGameAction(roomId: number) {
  return useMutation({
    mutationFn: (body: GameActionRequest) => gameApi.act(roomId, body),
    onSuccess: (room) => {
      queryClient.setQueryData(gameKeys.room(roomId), room);
      // 끝난 판은 캣머니가 오갔습니다. 상단 잔액 칩이 옛값을 들고 있으면 안 됩니다
      if (room.status === 'FINISHED') {
        void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
        void queryClient.invalidateQueries({ queryKey: gameKeys.myRoom() });
      }
    },
    /* 🔴 토스트를 띄우지 않습니다. "지금은 차례가 아닙니다" 는 빠르게 누르다 보면 늘
       나는 응답이라, 띄우면 화면이 토스트로 덮입니다. 화면이 차례를 이미 보여줍니다. */
  });
}

export function useLeaveGameRoom(roomId: number) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => gameApi.leave(roomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gameKeys.myRoom() });
      void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
      void navigate(ROUTES.GAME);
    },
    onError: (error: ApiError) => toast.error(error.message),
  });
}
