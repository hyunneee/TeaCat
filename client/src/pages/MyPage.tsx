import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Coins,
  Hourglass,
  LogOut,
  Receipt,
  ScanFace,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { AnimatedNumber, Badge, Button, Card, ListRow, SectionTitle } from '@/shared/components/ui';
import { useModal } from '@/app/providers';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { can, useAuth, useLogout } from '@/features/auth';
import { useTokenBalance } from '@/features/token';

/**
 * 헤더와 프로필 카드 사이 여백.
 *
 * 아바타 원(size-14)은 카드 위쪽으로 **28px(-top-7) 튀어나옵니다.**
 * 이 값이 28px 보다 작으면 원이 헤더 영역까지 올라가 제목('마이페이지')과 겹칩니다 —
 * 헤더가 투명하고 제목이 가운데 정렬이라 정확히 원 뒤로 숨습니다.
 * 40px 이면 원이 헤더 아래로 12px 내려와 안전합니다.
 *
 * ⚠️ 이 값을 바꾸면 아래 짙은 면의 top 계산이 **자동으로** 따라옵니다.
 *    둘을 따로 적으면 경계가 카드 중앙에서 어긋납니다.
 */
const HEADER_GAP = '2.5rem';

export function MyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useModal();
  const { user } = useAuth();
  const { data: token } = useTokenBalance();
  const logout = useLogout();

  /* 얼굴 미등록 상태로 예매에 들어가려다 튕겨 온 경우 (RequireFace).
     아무 설명 없이 화면만 바뀌면 왜 못 들어갔는지 알 수 없습니다. */
  const faceRequired = (location.state as { faceRequired?: boolean } | null)?.faceRequired;
  useEffect(() => {
    if (!faceRequired) return;
    toast.info('예매하려면 얼굴 등록을 먼저 마쳐 주세요.');
    // 안내는 한 번이면 충분합니다. state 를 지워 다시 들어와도 반복되지 않게.
    navigate(ROUTES.MY, { replace: true, state: null });
  }, [faceRequired, navigate]);

  return (
    <>
      {/* ── 프로필 ──
          검정 바탕이 **카드 중앙에서** 흰 바탕으로 넘어갑니다.
          카드가 두 바탕에 걸쳐 있으면 화면에서 한 겹 떠 보이고,
          그 위에 얹은 얼굴 아이콘이 이 화면의 주인이 누구인지 먼저 말해 줍니다.

          ⚠️ 헤더는 **투명 + 고정 해제**입니다. 배경 없는 헤더가 화면에 붙어 있으면
             아래 목록이 그 밑으로 지나가면서 글자가 겹칩니다. (Header sticky prop)
          ⚠️ 경계는 아래 컨테이너 높이의 50%(`bottom-1/2`)로 잡습니다.
             컨테이너가 카드 하나만 감싸고 있어야 그 50% 가 카드 중앙이 됩니다 —
             여백(HEADER_GAP)을 이 안에 넣으면 경계가 그만큼 위로 밀립니다. */}
      <Header title="마이페이지" transparent sticky={false} className="relative z-10 text-white" />

      <div style={{ paddingTop: HEADER_GAP }}>
        <div className="relative px-4">
          <div
            aria-hidden
            className="surface-strong absolute inset-x-0 bottom-1/2"
            style={{
              /* 헤더 위쪽(노치)까지 거슬러 올라가 화면 맨 위를 덮습니다.
                 위 여백과 **같은 값**이어야 경계가 카드 중앙에 옵니다 (HEADER_GAP) */
              top: `calc(-1 * (env(safe-area-inset-top) + var(--spacing-header) + ${HEADER_GAP}))`,
            }}
          />

          <div className="surface shadow-card relative rounded-2xl px-5 pt-11 pb-5 text-center">
            {/* 카드 위쪽 테두리에 절반만 걸칩니다 (size-14 → -top-7).
                위 절반이 짙은 배경 위에 놓이므로 **밝은 원**이어야 보입니다 —
                배경과 같은 어두운 원이면 흰 테두리만 동동 뜬 것처럼 보입니다. */}
            <span className="surface-2 border-surface-1 text-ink-muted absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4">
              <UserRound size={26} />
            </span>

            <p className="truncate text-lg font-extrabold">{user?.name}</p>
            <p className="text-subtle mt-0.5 truncate text-[0.8125rem]">@{user?.nickname}</p>

            <div className="mt-2.5 flex justify-center">
              {user?.faceRegistered ? (
                <Badge tone="success" size="md" icon={<ScanFace size={12} />}>
                  얼굴 등록 완료
                </Badge>
              ) : (
                <Badge tone="warning" size="md" icon={<ScanFace size={12} />}>
                  얼굴 미등록
                </Badge>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(ROUTES.TOKEN)}
              className="surface-2 hover:bg-surface-3 mt-4 flex w-full items-center gap-2 rounded-xl px-4 py-3 transition-colors"
            >
              <Coins size={17} className="text-ink-muted shrink-0" />
              <span className="text-ink-muted text-sm font-medium">캣머니</span>
              {/* 보여주는 건 **쓸 수 있는 금액**입니다 (token.types.ts 주석) */}
              <AnimatedNumber
                value={token?.available ?? 0}
                className="ml-auto text-[0.9375rem] font-extrabold"
              />
              <ChevronRight size={17} className="text-subtle shrink-0" />
            </button>

            {/* 묶인 돈이 있을 때만 한 줄. 이게 없으면 총액과의 차액이 어디로 갔는지
                알 수 없어 "돈이 사라졌다" 가 됩니다. 어느 경매에 묶였는지는
                내 입찰 화면이 보여줍니다. */}
            {!!token?.held && (
              <p className="text-subtle mt-1.5 text-xs">
                경매 입찰로 {token.held.toLocaleString()}캣머니 묶임
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4">
        {!user?.faceRegistered && (
          <Card
            tone="warning"
            interactive
            onClick={() => navigate(ROUTES.FACE_REGISTER)}
            className="flex items-center gap-3"
          >
            <ScanFace size={20} className="text-warning shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">얼굴을 등록해야 예매할 수 있어요</p>
              <p className="text-muted mt-0.5 text-xs leading-relaxed">
                한 번만 등록하면 예매한 티켓에 자동으로 매칭돼요.
              </p>
            </div>
            <ChevronRight size={17} className="text-subtle shrink-0" />
          </Card>
        )}

        <section>
          <SectionTitle>내 활동</SectionTitle>
          <Card padded={false} className="divide-line divide-y overflow-hidden">
            <ListRow
              icon={<Ticket size={18} />}
              title="내 예매 내역"
              onClick={() => navigate(ROUTES.MY_TICKETS)}
            />
            <ListRow
              icon={<Hourglass size={18} />}
              title="취소표 대기 내역"
              onClick={() => navigate(ROUTES.MY_RESALE)}
            />
            <ListRow
              icon={<Sparkles size={18} />}
              title="내 포토카드"
              onClick={() => navigate(ROUTES.MY_NFTS)}
            />
            <ListRow
              icon={<Receipt size={18} />}
              title="포카 거래 내역"
              onClick={() => navigate(ROUTES.MY_NFT_TRADES)}
            />
          </Card>
        </section>

        {/* 운영 역할만 보입니다. 일반 회원에게는 이 줄이 아예 없습니다.
            🔴 판단은 can.accessAdmin 한 곳입니다 — 서버 권한과 같아야 합니다. */}
        {can.accessAdmin(user) && (
          <section>
            <SectionTitle>운영</SectionTitle>
            <Card padded={false} className="overflow-hidden">
              <ListRow
                icon={<ShieldCheck size={18} />}
                title="운영 콘솔"
                description="데스크톱에서 열어주세요"
                onClick={() => navigate(ROUTES.ADMIN)}
              />
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>계정</SectionTitle>
          <Card padded={false} className="divide-line divide-y overflow-hidden">
            <ListRow
              icon={<ScanFace size={18} />}
              title="얼굴 등록 관리"
              description={user?.faceRegistered ? '등록됨 · 예매 시 자동 매칭' : '미등록 · 예매 불가'}
              onClick={() => navigate(ROUTES.FACE_REGISTER)}
            />
            <ListRow
              icon={<Settings size={18} />}
              title="설정"
              onClick={() => navigate(ROUTES.SETTINGS)}
            />
          </Card>
        </section>

        {/* 세션을 끊는 동작이라 붉게 표시하고 한 번 되묻습니다 */}
        <Button
          variant="danger-ghost"
          fullWidth
          size="lg"
          leftIcon={<LogOut size={17} />}
          loading={logout.isPending}
          onClick={() =>
            open('common/confirm', {
              title: '로그아웃할까요?',
              message: '진행 중인 예매가 있다면 처음부터 다시 시작해야 합니다.',
              confirmText: '로그아웃',
              danger: true,
              onConfirm: () => logout.mutate(),
            })
          }
        >
          로그아웃
        </Button>
      </div>
    </>
  );
}
