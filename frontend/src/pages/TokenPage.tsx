import { Coins, Construction } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card } from '@/shared/components/ui';
import { useTokenBalance } from '@/features/token';

/**
 * 토큰 벌기.
 *
 * ⚠️ 컨텐츠가 아직 정해지지 않았습니다 (순발력 미니게임? 출석 벌기?).
 * 잔액 조회와 화면 자리만 잡아두었습니다.
 * 기획이 확정되면 `features/token` 에 훅을 더하고 이 페이지는 조립만 하세요.
 */
export function TokenPage() {
  const { data: token } = useTokenBalance();

  return (
    <>
      <Header title="캣머니 벌기" showBack />

      <div className="space-y-4 p-4">
        <Card className="flex flex-col items-center gap-2 py-8">
          <Coins size={34} className="text-brand-500" />
          <p className="text-muted text-sm">보유 캣머니</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {(token?.balance ?? 0).toLocaleString()}
          </p>
          {/* 내부 식별자(symbol: 'CATMONEY')를 화면에 그대로 띄우지 마세요.
              사용자가 보는 이름은 언제나 "캣머니" 입니다. */}
          <p className="text-subtle text-xs">캣머니</p>
        </Card>

        <Card className="flex gap-3">
          <Construction size={20} className="text-warning shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">캣머니 모으기는 준비 중이에요</p>
            <p className="text-muted leading-relaxed">
              곧 캣머니를 모을 수 있는 방법을 열어 드릴게요. 지금 가진 캣머니는 포토카드 마켓에서
              카드를 사고파는 데 쓸 수 있어요.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
