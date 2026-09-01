import { Coins, Construction } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card } from '@/shared/components/ui';
import { useTokenBalance } from '@/features/token';

/**
 * 토큰 채굴.
 *
 * ⚠️ 컨텐츠가 아직 정해지지 않았습니다 (순발력 미니게임? 출석 채굴?).
 * 잔액 조회와 화면 자리만 잡아두었습니다.
 * 기획이 확정되면 `features/token` 에 훅을 더하고 이 페이지는 조립만 하세요.
 */
export function TokenPage() {
  const { data: token } = useTokenBalance();

  return (
    <>
      <Header title="포도알 채굴" showBack />

      <div className="space-y-4 p-4">
        <Card className="flex flex-col items-center gap-2 py-8">
          <Coins size={34} className="text-brand-500" />
          <p className="text-muted text-sm">보유 포도알</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {(token?.balance ?? 0).toLocaleString()}
          </p>
          <p className="text-subtle text-xs">{token?.symbol ?? 'GRAPE'}</p>
        </Card>

        <Card className="flex gap-3">
          <Construction size={20} className="text-warning shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">준비 중이에요</p>
            <p className="text-muted leading-relaxed">
              채굴 컨텐츠(순발력 미니게임 등)는 기획 확정 후 추가됩니다. 모은 포도알로는 포토카드
              마켓에서 거래할 수 있어요.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
