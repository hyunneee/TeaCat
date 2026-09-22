import { useParams } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card, Spinner } from '@/shared/components/ui';
import {
  GameLobbyPanel,
  GameResultCard,
  HalliGalliPanel,
  YutPanel,
  useGameAction,
  useGameReady,
  useGameRoom,
  useLeaveGameRoom,
  useStartGame,
} from '@/features/game';
import type { HalliGalliState, YutState } from '@/features/game';

/**
 * 방 하나 — 대기실과 게임판이 한 화면입니다.
 *
 * <p>판이 끝나면 대기실로 돌아가지 않고 결과를 그 자리에 보여줍니다. 결과를 보려고
 * 다른 화면으로 옮겨 가면, 방금 무슨 일이 있었는지 다시 짚어 볼 곳이 없어집니다.
 */
export function GameRoomPage() {
  const { roomId: raw } = useParams<{ roomId: string }>();
  const roomId = Number(raw);

  const { data: room, isLoading, connected } = useGameRoom(Number.isFinite(roomId) ? roomId : undefined);
  const ready = useGameReady(roomId);
  const start = useStartGame(roomId);
  const action = useGameAction(roomId);
  const leave = useLeaveGameRoom(roomId);

  if (isLoading || !room) {
    return (
      <>
        <Header title="같이 하기" />
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      </>
    );
  }

  const title = room.gameType === 'YUT' ? '윷놀이' : '할리갈리';
  const over = room.status === 'FINISHED' || room.status === 'ABORTED';

  return (
    <>
      <Header title={title} />

      <div className="space-y-4 p-4">
        {/* 연결이 끊기면 조용히 폴링으로 버팁니다. 다만 느려진 이유는 알려줍니다 */}
        {!connected && !over && (
          <p className="text-muted flex items-center justify-center gap-1 text-xs">
            <WifiOff size={12} /> 실시간 연결이 끊겨 다시 붙는 중이에요
          </p>
        )}

        {room.status === 'WAITING' && (
          <GameLobbyPanel
            room={room}
            onReady={(value) => ready.mutate(value)}
            onStart={() => start.mutate()}
            busy={ready.isPending || start.isPending}
          />
        )}

        {room.status === 'PLAYING' && room.state && (
          <>
            {room.gameType === 'YUT' ? (
              <YutPanel
                room={room}
                state={room.state as YutState}
                onAction={(body) => action.mutate(body)}
                pending={action.isPending}
              />
            ) : (
              <HalliGalliPanel
                room={room}
                state={room.state as HalliGalliState}
                onAction={(body) => action.mutate(body)}
                pending={action.isPending}
              />
            )}

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              loading={leave.isPending}
              onClick={() => leave.mutate()}
            >
              게임 포기하고 나가기
            </Button>
          </>
        )}

        {room.status === 'FINISHED' && (
          <GameResultCard room={room} onLeave={() => leave.mutate()} busy={leave.isPending} />
        )}

        {room.status === 'ABORTED' && (
          <Card className="space-y-3 text-center">
            <p className="text-sm font-bold">판이 깨졌어요</p>
            <p className="text-muted text-xs">걸었던 캣머니는 그대로 돌려드렸어요.</p>
            <Button variant="primary" size="md" fullWidth onClick={() => leave.mutate()}>
              나가기
            </Button>
          </Card>
        )}
      </div>
    </>
  );
}

export default GameRoomPage;
