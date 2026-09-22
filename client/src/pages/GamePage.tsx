import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dices, Hand, LogIn, Users } from 'lucide-react';
import { Button, Card, Input } from '@/shared/components/ui';
import { Header } from '@/shared/components/layout';
import { ROUTES } from '@/shared/constants/routes';
import {
  useCreateGameRoom,
  useGamePolicy,
  useJoinGameRoom,
  useMyGameRoom,
} from '@/features/game';
import type { GameType } from '@/features/game';

const GAMES: { type: GameType; name: string; description: string; icon: typeof Dices }[] = [
  {
    type: 'YUT',
    name: '윷놀이',
    description: '던지고, 업고, 잡고. 지름길을 타면 11칸이면 끝나요',
    icon: Dices,
  },
  {
    type: 'HALLI_GALLI',
    name: '할리갈리',
    description: '같은 과일이 딱 5개일 때 먼저 종을 치세요',
    icon: Hand,
  },
];

/**
 * 같이 하는 게임 입구 — 방을 만들거나 초대 코드로 들어갑니다.
 *
 * <p>🔴 이미 들어가 있는 방이 있으면 <b>그리로 돌려보냅니다.</b> 한 사람이 두 방에 있을 수
 * 없는데(판돈이 두 군데 묶입니다) 여기서 새 방을 만들면 서버가 거절만 하고 사용자는
 * 왜 안 되는지 모릅니다.
 */
export function GamePage() {
  const navigate = useNavigate();
  const { data: policy, isPending: policyLoading, isError: policyFailed } = useGamePolicy();
  const { data: myRoom } = useMyGameRoom();

  const [gameType, setGameType] = useState<GameType>('YUT');
  const [betAmount, setBetAmount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [code, setCode] = useState('');

  const create = useCreateGameRoom();
  const join = useJoinGameRoom();

  /**
   * 고를 수 있는 판돈.
   *
   * 🔴 **서버에서 못 받아왔을 때 `[0]`(연습)으로 때우지 않습니다.** 예전에는 그랬는데,
   * 서버가 죽어 있으면 화면에 "연습" 한 칸만 남아서 **원래 판돈을 걸 수 없는 기능처럼**
   * 보였습니다. 금액이 안 보이는 것과 서버가 답을 안 하는 것은 사용자가 할 일이 서로
   * 다르므로(기다리기 / 새로고침) 구분해서 말해 줍니다.
   */
  const betChoices = policy?.betChoices ?? [];
  const solo = maxPlayers === 1;
  /* 판돈 목록을 모르면 만들어도 서버가 거절합니다. 눌러서 실패하게 두지 않습니다 */
  const canCreate = !policyLoading && !policyFailed && betChoices.length > 0;

  return (
    <>
      <Header title="같이 하기" />

      <div className="space-y-4 p-4">
        {myRoom && (
          <Card className="space-y-2">
            <p className="text-sm font-bold">참여 중인 방이 있어요</p>
            <p className="text-muted text-xs">
              {myRoom.gameType === 'YUT' ? '윷놀이' : '할리갈리'} · 코드 {myRoom.inviteCode}
            </p>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => void navigate(ROUTES.GAME_ROOM.replace(':roomId', String(myRoom.roomId)))}
            >
              돌아가기
            </Button>
          </Card>
        )}

        {/* 초대 코드로 들어가기 */}
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <LogIn size={16} className="text-muted" />
            <p className="text-sm font-bold">초대 코드로 들어가기</p>
          </div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: K7PQ2M"
            maxLength={8}
            className="text-center font-mono text-lg tracking-[0.25em]"
          />
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={code.trim().length < 4}
            loading={join.isPending}
            onClick={() => join.mutate(code)}
          >
            들어가기
          </Button>
        </Card>

        {/* 방 만들기 */}
        <Card className="space-y-4">
          <p className="text-sm font-bold">방 만들기</p>

          <div className="grid grid-cols-2 gap-2">
            {GAMES.map(({ type, name, description, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setGameType(type)}
                className={[
                  'rounded-2xl p-3 text-left transition',
                  gameType === type ? 'bg-brand-50 ring-brand-400 ring-2' : 'surface-2',
                ].join(' ')}
              >
                <Icon size={18} className="text-brand-500" />
                <p className="mt-1 text-sm font-bold">{name}</p>
                <p className="text-muted mt-0.5 text-[11px] leading-tight">{description}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-muted flex items-center gap-1 text-xs">
              <Users size={12} /> 인원
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    setMaxPlayers(count);
                    if (count === 1) setBetAmount(0);
                  }}
                  className={[
                    'rounded-xl py-2 text-sm font-bold',
                    maxPlayers === count ? 'bg-brand-500 text-white' : 'surface-2 text-muted',
                  ].join(' ')}
                >
                  {count}명
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted text-xs">1인당 판돈</p>

            {policyLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((slot) => (
                  <div key={slot} className="surface-2 h-9 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : policyFailed ? (
              <p className="text-danger text-xs">
                판돈 정보를 불러오지 못했어요. 잠시 후 새로고침해 주세요.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {betChoices.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={solo && amount > 0}
                    onClick={() => setBetAmount(amount)}
                    className={[
                      'rounded-xl py-2 text-sm font-bold disabled:opacity-40',
                      betAmount === amount ? 'bg-brand-500 text-white' : 'surface-2 text-muted',
                    ].join(' ')}
                  >
                    {amount === 0 ? '연습' : amount.toLocaleString()}
                  </button>
                ))}
              </div>
            )}

            {solo ? (
              <p className="text-muted text-xs">혼자 하는 방은 연습으로만 할 수 있어요.</p>
            ) : (
              policy && betAmount > 0 && (
                <p className="text-muted text-xs">
                  티캣이 인원수마다 {policy.subsidyPerPlayer.toLocaleString()} 캣머니를 상금에 얹어줘요.
                  등수대로 나눠 가져요 (
                  {(policy.prizeShares[maxPlayers - 1] ?? []).map((share) => `${share}%`).join(' · ')}).
                  {policy.remainingSubsidyToday < policy.subsidyPerPlayer * maxPlayers && (
                    <> 오늘 받을 수 있는 보조금이 {policy.remainingSubsidyToday.toLocaleString()} 남았어요.</>
                  )}
                </p>
              )
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canCreate}
            loading={create.isPending || policyLoading}
            onClick={() => create.mutate({ gameType, betAmount, maxPlayers })}
          >
            방 만들기
          </Button>
        </Card>
      </div>
    </>
  );
}

export default GamePage;
