import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Coins,
  Dices,
  LogOut,
  Receipt,
  ScanFace,
  Settings,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { AnimatedNumber, Badge, Button, Card, ListRow, SectionTitle } from '@/shared/components/ui';
import { useModal } from '@/app/providers';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { useAuth, useLogout } from '@/features/auth';
import { useTokenBalance } from '@/features/nft';

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
             여백(pt-3)을 이 안에 넣으면 경계가 그만큼 위로 밀립니다. */}
      <Header title="MY" transparent sticky={false} className="relative z-10 text-white" />

      <div className="pt-3">
        <div className="relative px-4">
          <div
            aria-hidden
            className="surface-ink absolute inset-x-0 bottom-1/2"
            style={{
              /* 헤더 위쪽(노치)까지 거슬러 올라가 화면 맨 위를 덮습니다 */
              top: 'calc(-1 * (env(safe-area-inset-top) + var(--spacing-header) + 0.75rem))',
            }}
          />

          <div className="surface shadow-card relative rounded-2xl px-5 pt-11 pb-5 text-center">
            {/* 카드 위쪽 테두리에 절반만 걸칩니다 (size-14 → -top-7) */}
            <span className="bg-brand-900 border-surface-1 absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4 text-white">
              <UserRound size={26} />
            </span>

            <p className="truncate text-lg font-extrabold">{user?.name}</p>
            <p className="text-subtle mt-0.5 truncate text-[0.8125rem]">@{user?.loginId}</p>

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
              <span className="text-ink-muted text-sm font-medium">포도알</span>
              <AnimatedNumber
                value={token?.balance ?? 0}
                className="ml-auto text-[0.9375rem] font-extrabold"
              />
              <ChevronRight size={17} className="text-subtle shrink-0" />
            </button>
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
                한 번만 등록하면 됩니다. 예매한 티켓에 자동으로 매칭돼요.
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
              icon={<Dices size={18} />}
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
