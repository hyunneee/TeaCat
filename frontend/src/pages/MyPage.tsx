import { useNavigate } from 'react-router-dom';
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
import { ROUTES } from '@/shared/constants';
import { useAuth, useLogout } from '@/features/auth';
import { useTokenBalance } from '@/features/nft';

export function MyPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { user } = useAuth();
  const { data: token } = useTokenBalance();
  const logout = useLogout();

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
            <p className="flex-1 text-sm font-semibold">얼굴을 등록해야 입장할 수 있어요</p>
            <ChevronRight size={17} className="text-subtle" />
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
              title="NFT 포카 내역"
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
              description={user?.faceRegistered ? '등록됨' : '미등록'}
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
