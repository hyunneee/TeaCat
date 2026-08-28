import { ArrowUpCircle, CheckCircle2, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card, SectionTitle } from '@/shared/components/ui';
import { env } from '@/shared/config';
import { formatDateTime } from '@/shared/lib';
import { UPDATE_STATE_LABEL, useAppVersion, type UpdateState } from '@/features/appInfo';

/**
 * 앱 정보.
 *
 * 문의가 들어올 때 가장 먼저 물어보는 게 "버전이 몇인가요?" 입니다.
 * 사용자가 직접 찾아 읽을 수 있는 자리를 만들어 둡니다.
 *
 * 최신 버전 비교는 서버(`GET /app/version`)가 알려줍니다 — 아직 백엔드가 없으면
 * 목업이 응답하고, 조회에 실패해도 **현재 버전은 항상** 보입니다.
 */
const STATE_STYLE: Record<UpdateState, { icon: typeof Info; className: string }> = {
  CURRENT: { icon: CheckCircle2, className: 'text-ink-muted' },
  OUTDATED: { icon: ArrowUpCircle, className: 'text-ink' },
  REQUIRED: { icon: TriangleAlert, className: 'text-danger' },
  UNKNOWN: { icon: Info, className: 'text-ink-subtle' },
};

export function AboutPage() {
  const version = useAppVersion();
  const { icon: StateIcon, className } = STATE_STYLE[version.state];

  return (
    <>
      <Header title="앱 정보" showBack />

      <div className="space-y-6 p-4">
        <section>
          <SectionTitle>버전</SectionTitle>
          <Card className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">현재 버전</span>
              <span className="font-bold tabular-nums">{version.current}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">최신 버전</span>
              <span className="font-medium tabular-nums">
                {version.latest ?? (version.isChecking ? '확인 중…' : '알 수 없음')}
              </span>
            </div>
            {version.releasedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">배포일</span>
                <span className="font-medium">{formatDateTime(version.releasedAt)}</span>
              </div>
            )}

            <div className="border-line mt-1 flex items-start gap-2 border-t pt-3">
              <StateIcon size={17} className={`mt-0.5 shrink-0 ${className}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${className}`}>
                  {UPDATE_STATE_LABEL[version.state]}
                </p>
                {version.notes && (
                  <p className="text-muted mt-0.5 text-xs leading-relaxed">{version.notes}</p>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              fullWidth
              loading={version.isChecking}
              leftIcon={<RefreshCw size={16} />}
              onClick={version.recheck}
            >
              업데이트 확인
            </Button>

            {version.state === 'OUTDATED' && (
              <p className="text-subtle text-xs leading-relaxed">
                새로고침하면 최신 버전이 적용됩니다. 설치형(PWA)으로 쓰고 있다면 앱을 완전히 닫고
                다시 열어주세요.
              </p>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>서비스</SectionTitle>
          <Card className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">서비스명</span>
              <span className="font-medium">{env.appName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">환경</span>
              <span className="font-medium">{env.name}</span>
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}
