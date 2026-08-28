import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Coins,
  Dices,
  LogOut,
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
      <Header title="MY" />

      <div className="space-y-6 p-4">
        {/* 프로필 */}
        <Card className="flex items-center gap-3.5">
          <span className="bg-brand-950 border-brand-800 text-brand-700 flex size-14 shrink-0 items-center justify-center rounded-xl border">
            <UserRound size={26} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{user?.name}</p>
            <p className="text-subtle truncate text-xs">@{user?.loginId}</p>
            <div className="mt-1.5">
              {user?.faceRegistered ? (
                <Badge tone="success" icon={<ScanFace size={11} />}>
                  얼굴 등록 완료
                </Badge>
              ) : (
                <Badge tone="warning" icon={<ScanFace size={11} />}>
                  얼굴 미등록
                </Badge>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.TOKEN)}
            className="surface-2 border-line hover:border-accent-600 flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition-colors"
          >
            <Coins size={15} className="text-accent-400" />
            <AnimatedNumber value={token?.balance ?? 0} className="text-xs font-bold" />
          </button>
        </Card>

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
              title="포카 거래 내역"
              onClick={() => navigate(ROUTES.MY_NFTS)}
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
