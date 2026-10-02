import { useNavigate, useParams } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card, Spinner } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants/routes';
import { useModal } from '@/app/providers';
import {
  GameLobbyPanel,
  GameChatPanel,
  GameResultCard,
  HalliGalliPanel,
  YutPanel,
  useGameAction,
  useGameChat,
  useGameReady,
  useGameRoom,
  useLeaveGameRoom,
  usePickPieceStyle,
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
  const navigate = useNavigate();

  /* 🔴 뒤로 가기는 **방을 나가는 것이 아닙니다.** 화면만 벗어나고 방은 그대로 있어서,
     같이 하기 화면의 "참여 중인 방이 있어요" 로 다시 들어올 수 있습니다. 판돈을 걸고
     시작한 뒤에 뒤로 눌렀다고 판돈을 잃으면 사고입니다 — 포기는 아래 버튼으로만 합니다. */
  const goBack = () => navigate(ROUTES.GAME);

  const { data: room, isLoading, connected } = useGameRoom(Number.isFinite(roomId) ? roomId : undefined);
  const ready = useGameReady(roomId);
  const pieceStyle = usePickPieceStyle(roomId);
  const start = useStartGame(roomId);
  const action = useGameAction(roomId);
  const leave = useLeaveGameRoom(roomId);
  const { open } = useModal();
  const chat = useGameChat(roomId, connected);

  /* 채팅 창은 대기실과 두 게임판이 똑같이 씁니다. 여기서 한 번 만들어 내려주면 판
     컴포넌트가 채팅을 전혀 몰라도 됩니다 — feature 안의 컴포넌트는 props 로 받은 것만
     쓰고 서버를 모릅니다 (client/CLAUDE.md 4-3) */
  const chatPanel = (
    <GameChatPanel
      messages={chat.messages}
      participants={room?.participants ?? []}
      mySeatNo={room?.mySeatNo ?? 0}
      onSend={(message) => chat.send.mutate(message)}
      sending={chat.send.isPending}
    />
  );

  if (isLoading || !room) {
    return (
      <>
        <Header title="같이 하기" showBack onBack={goBack} />
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
      <Header title={title} showBack onBack={goBack} />

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
            onPickPieceStyle={(style) => pieceStyle.mutate(style)}
            onStart={() => start.mutate()}
            busy={ready.isPending || start.isPending || pieceStyle.isPending}
            chat={chatPanel}
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
                chat={chatPanel}
              />
            ) : (
              <HalliGalliPanel
                room={room}
                state={room.state as HalliGalliState}
                onAction={(body) => action.mutate(body)}
                pending={action.isPending}
                chat={chatPanel}
              />
            )}

            {/* 🔴 **되돌릴 수 없는 동작입니다** — 걸어 둔 캣머니를 잃고 판에도 못 돌아옵니다.
                CLAUDE.md 4-7 에 따라 붉은 버튼 + 확인 모달입니다.
                예전에는 `ghost` 버튼 하나뿐이라, 채팅을 누르려다 손가락이 닿으면 그대로
                판에서 나가졌습니다 (그 위 패널이 차례마다 높이가 달라 버튼이 올라왔습니다). */}
            <Button
              variant="danger-ghost"
              size="md"
              fullWidth
              loading={leave.isPending}
              onClick={() =>
                open('common/confirm', {
                  title: '게임을 포기할까요?',
                  message:
                    '지금 나가면 걸어 둔 캣머니를 잃고 이 판으로 돌아올 수 없어요. 남은 사람들끼리 계속 진행됩니다.',
                  confirmText: '포기하고 나가기',
                  danger: true,
                  onConfirm: () => leave.mutate(),
                })
              }
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
