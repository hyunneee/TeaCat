import { Activity } from 'lucide-react';
import { EmptyState } from '@/shared/components/common';

/**
 * 운영 모니터링 대시보드 (ADMIN 전용).
 * TODO: features/monitoring — 대용량 트래픽 지표, 대기열 현황, 사용자 모니터링
 */
export function MonitoringPage() {
  return (
    <>
      <h1 className="text-ink text-lg font-bold">운영 모니터링</h1>
      <EmptyState
        icon={Activity}
        title="모니터링 대시보드"
        description="트래픽과 대기열 현황을 여기에서 볼 수 있게 준비하고 있어요."
      />
    </>
  );
}
