import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        mood="sad"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 삭제된 페이지입니다."
        action={
          <Button variant="soft" onClick={() => navigate(ROUTES.HOME, { replace: true })}>
            홈으로 가기
          </Button>
        }
      />
    </div>
  );
}
