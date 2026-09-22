import { useNavigate } from 'react-router-dom';
import { ChevronRight, Coins, Dices, Grid2x2, Hand } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card, SectionTitle } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import {
  AttendanceCard,
  MemoryRankingCard,
  SongpyeonPiece,
  useAttendance,
  useMemoryRanking,
  useTokenBalance,
} from '@/features/token';

/**
 * 캣치 — 캣머니를 모으는 자리.
 *
 * <p>하단 탭의 목적지입니다(`navTabs` 의 '캣치'). 탭 루트라 <b>뒤로가기를 두지 않습니다</b>.
 *
 * <p>🔴 **잔액은 크게 띄우지 않습니다.** 예전에는 화면 절반을 잔액 카드가 차지했는데,
 * 여기는 "얼마 있나" 를 보러 오는 자리가 아니라 **모으러** 오는 자리입니다. 잔액은 상단 내비와
 * 마이페이지에서 이미 보이므로 한 줄로 줄이고, 그 자리를 게임에 내줍니다.
 *
 * <p>🔴 **여기서 바로 게임이 시작되지 않습니다.** 들어오자마자 판이 깔리면 순위도 출석도
 * 볼 수 없습니다. 게임은 각자의 화면으로 길을 나눠 두었습니다.
 */
export function TokenPage() {
  const navigate = useNavigate();
  const { data: token } = useTokenBalance();
  const attendance = useAttendance();
  const { data: ranking, isPending: rankingPending } = useMemoryRanking();

  return (
    <>
      <Header title="캣치" />

      <div className="space-y-4 p-4">
        {/* 잔액 한 줄. 총액·묶인 금액 같은 자세한 건 마이페이지가 보여줍니다 */}
        <Card className="flex items-center gap-2 py-3">
          <Coins size={18} className="text-brand-500 shrink-0" aria-hidden />
          <span className="text-muted flex-1 text-sm">쓸 수 있는 캣머니</span>
          <span className="text-lg font-extrabold tabular-nums">
            {(token?.available ?? 0).toLocaleString()}
          </span>
        </Card>

        {/* ── 캣머니 벌기 ──────────────────────────────────
            🔴 실제로 캣머니가 들어오는 것은 출석 체크·송편 잡기·짝 맞추기 1등 셋입니다.
            한 화면에 primary 버튼은 하나라(CLAUDE.md 4-6) 출석 카드가 그 하나를 가집니다. */}
        <SectionTitle>캣머니 벌기</SectionTitle>

        <AttendanceCard
          amount={attendance.amount}
          claimed={attendance.claimed}
          loading={attendance.loading}
          claiming={attendance.claiming}
          onCheck={attendance.check}
        />

        {/* 게임은 누르는 줄(ListRow) 대신 **각자 카드**입니다. 줄로 두면 설정 목록처럼 읽혀서
            "놀거리" 로 보이지 않았습니다. 무엇을 하면 뭘 받는지를 카드마다 적습니다. */}
        <div className="grid grid-cols-2 gap-3">
          <GameCard
            icon={<SongpyeonPiece kind="songpyeon" size={26} />}
            title="송편 잡기"
            reward="하루 한 번 1,000"
            description="5단계 통과"
            onClick={() => navigate(ROUTES.TOKEN_SONGPYEON)}
          />
          <GameCard
            icon={<Grid2x2 size={26} className="text-brand-500" />}
            title="포토카드 짝 맞추기"
            reward="1등이면 다음날 1,000"
            description="빠를수록 위"
            onClick={() => navigate(ROUTES.TOKEN_GAME)}
          />
        </div>

        {/* ── 같이 하기 ──────────────────────────────────
            🔴 위쪽 "캣머니 벌기" 와 나눠 둡니다. 저쪽은 혼자 해서 받는 자리이고 이쪽은
            **걸고 겨루는** 자리라, 섞어 놓으면 판돈이 걸린다는 것을 모르고 들어갑니다. */}
        <SectionTitle>같이 하기</SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <GameCard
            icon={<Dices size={26} className="text-brand-500" />}
            title="윷놀이"
            reward="1~4인 · 등수대로"
            description="업고 잡고 지름길"
            onClick={() => navigate(ROUTES.GAME)}
          />
          <GameCard
            icon={<Hand size={26} className="text-brand-500" />}
            title="할리갈리"
            reward="1~4인 · 등수대로"
            description="같은 과일 5개면 종"
            onClick={() => navigate(ROUTES.GAME)}
          />
        </div>

        {/* ── 짝 맞추기 순위 ────────────────────────────── */}
        <SectionTitle>포토카드 짝 맞추기</SectionTitle>
        <MemoryRankingCard ranking={ranking} loading={rankingPending} />
      </div>
    </>
  );
}

interface GameCardProps {
  icon: React.ReactNode;
  title: string;
  /** 무엇을 받는지. 이게 없으면 그냥 게임 목록이 됩니다 */
  reward: string;
  description: string;
  onClick: () => void;
}

/** 놀거리 한 칸. 아이콘·이름·보상·한 줄 설명 */
function GameCard({ icon, title, reward, description, onClick }: GameCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface shadow-card hover:shadow-list flex flex-col gap-2 rounded-2xl p-4 text-left transition-shadow"
    >
      <span className="surface-2 flex size-11 items-center justify-center rounded-xl">{icon}</span>
      <span className="flex items-center gap-0.5 text-sm font-bold">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight size={15} className="text-ink-subtle shrink-0" aria-hidden />
      </span>
      <span className="text-brand-600 text-xs font-semibold">{reward}</span>
      <span className="text-subtle text-xs">{description}</span>
    </button>
  );
}
