import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Info,
  KeyRound,
  ScanFace,
  ShieldX,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card, ListRow, SectionTitle } from '@/shared/components/ui';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { useAuth, useWithdraw } from '@/features/auth';
import { useFaceRemoval } from '@/features/face';
import { PERMISSION_LABEL, useNotificationPermission } from '@/features/notification';
import { useAppVersion } from '@/features/appInfo';

export function SettingsPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { user } = useAuth();
  const withdraw = useWithdraw();
  const removeFace = useFaceRemoval();
  const notify = useNotificationPermission();
  const version = useAppVersion();

  return (
    <>
      <Header title="설정" showBack />

      <div className="space-y-6 p-4">
        <section>
          <SectionTitle>계정 설정</SectionTitle>
          <Card padded={false} className="divide-line divide-y overflow-hidden">
            <ListRow
              icon={<KeyRound size={18} />}
              title="비밀번호 변경"
              onClick={() => navigate(ROUTES.SETTINGS_PASSWORD)}
            />
            <ListRow
              icon={<UserRound size={18} />}
              title="닉네임 변경"
              description={user?.nickname}
              onClick={() => navigate(ROUTES.SETTINGS_NICKNAME)}
            />
            {/* 권한 요청은 사용자가 직접 누른 직후에만 할 수 있습니다.
                한 번 차단되면 앱에서 되돌릴 수 없어 브라우저 설정으로 안내합니다. */}
            <ListRow
              icon={<Bell size={18} />}
              title="추첨 당첨 알림"
              description={PERMISSION_LABEL[notify.state]}
              trailing={
                <span className="text-subtle text-xs">
                  {notify.granted ? '켜짐' : notify.state === 'denied' ? '차단' : '꺼짐'}
                </span>
              }
              hideChevron
              disabled={!notify.supported || notify.granted || notify.state === 'denied'}
              onClick={() => void notify.request()}
            />
          </Card>
        </section>

        <section>
          <SectionTitle>정보</SectionTitle>
          <Card padded={false} className="divide-line divide-y overflow-hidden">
            <ListRow
              icon={<Info size={18} />}
              title="앱 정보"
              description={`버전 ${version.current}`}
              onClick={() => navigate(ROUTES.SETTINGS_ABOUT)}
            />
          </Card>
        </section>

        {/* 되돌릴 수 없는 동작들은 한 구획으로 몰고 전부 붉게 */}
        <section>
          <SectionTitle description="한 번 실행하면 되돌릴 수 없어요">위험 구역</SectionTitle>
          <Card tone="danger" padded={false} className="divide-danger/20 divide-y overflow-hidden">
            <ListRow
              icon={<ScanFace size={18} />}
              title="등록된 얼굴 삭제"
              description={user?.faceRegistered ? '등록됨' : '등록된 얼굴이 없습니다'}
              danger
              hideChevron
              disabled={!user?.faceRegistered}
              onClick={() =>
                open('common/confirm', {
                  title: '등록된 얼굴을 삭제할까요?',
                  message: '삭제하면 보유한 티켓으로 입장할 수 없습니다. 다시 등록해야 합니다.',
                  confirmText: '삭제',
                  danger: true,
                  onConfirm: () => removeFace.mutate(),
                })
              }
            />
            <ListRow
              icon={<Trash2 size={18} />}
              title="회원 탈퇴"
              description="모든 티켓과 포토카드가 사라집니다"
              danger
              hideChevron
              onClick={() =>
                open('common/confirm', {
                  title: '정말 탈퇴하시겠어요?',
                  message:
                    '보유한 티켓과 포토카드가 모두 사라지며 복구할 수 없습니다. 예매한 공연이 있다면 먼저 취소해 주세요.',
                  confirmText: '탈퇴하기',
                  danger: true,
                  onConfirm: () => withdraw.mutate(),
                })
              }
            />
          </Card>

          <p className="text-danger/85 mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            탈퇴 후에는 예매 내역과 포토카드를 복구할 수 없습니다.
          </p>
        </section>

        <p className="text-subtle flex items-start gap-1.5 px-1 text-xs leading-relaxed">
          <ShieldX size={13} className="mt-0.5 shrink-0" />
          등록한 얼굴 정보는 입장 시 본인 확인 목적으로만 사용되며, 탈퇴 시 즉시 파기됩니다.
        </p>
      </div>
    </>
  );
}
