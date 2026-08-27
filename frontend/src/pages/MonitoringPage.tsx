import { Activity } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState } from '@/shared/components/common';

/**
 * 운영 모니터링 대시보드 (ADMIN 전용).
 * TODO: features/monitoring — 대용량 트래픽 지표, 대기열 현황, 사용자 모니터링
 */
export function MonitoringPage() {
  return (
    <>
      <Header title="운영 모니터링" showBack />
      <EmptyState
        icon={Activity}
        title="모니터링 대시보드"
        description="트래픽/대기열 지표는 백엔드 메트릭 연동 후 구현합니다."
      />
    </>
  );
}
