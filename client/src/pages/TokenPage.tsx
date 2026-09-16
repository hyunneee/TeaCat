import { useNavigate } from 'react-router-dom';
import { Coins, Gamepad2 } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card, ListRow } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { useTokenBalance } from '@/features/token';

/**
 * 캣머니 — 잔액과 모으는 방법.
 *
 * 🔴 **여기서 바로 게임이 시작되지 않습니다.** 마이페이지에서 잔액을 보려고 누르는
 * 자리라, 들어오자마자 판이 깔리면 잔액을 볼 수 없습니다. 게임은 `/token/game` 으로
 * 길을 나눠 두었습니다 (`ROUTES.TOKEN_GAME`).
 */
export function TokenPage() {
  const navigate = useNavigate();
  const { data: token } = useTokenBalance();

  return (
    <>
      <Header title="캣머니" showBack />

      <div className="space-y-4 p-4">
        <Card className="flex flex-col items-center gap-2 py-8">
          <Coins size={34} className="text-brand-500" />
          <p className="text-muted text-sm">쓸 수 있는 캣머니</p>
          {/* 총액이 아니라 **쓸 수 있는 금액**입니다 (features/token 의 token.types.ts 주석) */}
          <p className="text-3xl font-extrabold tabular-nums">
            {(token?.available ?? 0).toLocaleString()}
          </p>
          {/* 내부 식별자(symbol: 'CATMONEY')를 화면에 그대로 띄우지 마세요.
              사용자가 보는 이름은 언제나 "캣머니" 입니다. */}
          <p className="text-subtle text-xs">캣머니</p>

          {/* 여기는 잔액을 보러 오는 화면이라 총액과 묶인 금액을 함께 풀어 줍니다.
              마이페이지는 한 줄만 보여주고, 자세한 건 이 화면입니다. */}
          {!!token?.held && (
            <div className="border-line mt-3 w-full space-y-1 border-t pt-3 text-xs">
              <p className="flex justify-between">
                <span className="text-muted">보유 총액</span>
                <span className="font-semibold tabular-nums">{token.balance.toLocaleString()}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">경매 입찰로 묶임</span>
                <span className="font-semibold tabular-nums">−{token.held.toLocaleString()}</span>
              </p>
            </div>
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <ListRow
            icon={<Gamepad2 size={18} />}
            title="캣머니 게임하기"
            description="포토카드 짝 맞추기"
            onClick={() => navigate(ROUTES.TOKEN_GAME)}
          />
        </Card>
      </div>
    </>
  );
}
