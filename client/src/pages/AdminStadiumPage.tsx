import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AdminStadiumWorkspace,
  clearStadiumEditorDraft,
  loadStadiumEditorDraft,
  useStadiumDraftNavigationGuard,
  useStadiumEditor,
} from '@/features/stadium';
import { Button, Modal } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';

export function AdminStadiumPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const controller = useStadiumEditor();
  const { startFromLayout, startLayoutForStadium } = controller;
  const initializedKey = useRef('');
  const requestedStadiumId = Number(searchParams.get('stadiumId'));
  const requestedLayoutId = Number(searchParams.get('sourceLayoutId'));
  const guard = useStadiumDraftNavigationGuard(controller);

  useEffect(() => {
    if (initializedKey.current) return;
    if (Number.isInteger(requestedStadiumId) && requestedStadiumId > 0) {
      initializedKey.current = `${requestedStadiumId}:${requestedLayoutId || ''}`;
      clearStadiumEditorDraft();
      startLayoutForStadium(requestedStadiumId);
      if (Number.isInteger(requestedLayoutId) && requestedLayoutId > 0) {
        startFromLayout.mutate(requestedLayoutId);
      }
      return;
    }
    initializedKey.current = 'draft';
    const draft = loadStadiumEditorDraft();
    if (draft) controller.restoreDraft(draft);
  }, [controller, requestedLayoutId, requestedStadiumId, startFromLayout, startLayoutForStadium]);

  return (
    <>
      <AdminStadiumWorkspace
        controller={controller}
        onExit={() => navigate(ROUTES.ADMIN_STADIUMS)}
      />
      <Modal
        open={guard.blocked}
        variant="center"
        width="wide"
        dismissible={false}
        title="작업을 임시저장할까요?"
        description="좌석 배치 작업을 나가기 전에 선택해 주세요."
        onClose={guard.stay}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="soft" fullWidth onClick={guard.stay}>
              계속 작업
            </Button>
            <Button variant="danger-ghost" fullWidth onClick={guard.discardAndLeave}>
              저장하지 않고 이동
            </Button>
            <Button fullWidth onClick={guard.saveAndLeave}>
              임시저장 후 이동
            </Button>
          </div>
        }
      >
        <p className="text-ink-muted text-sm leading-relaxed">
          임시저장하면 이 브라우저에서 좌석 배치 관리 페이지를 다시 열 때 작업을 이어서 할 수
          있습니다. 저장하지 않으면 현재 단계와 편집 내용이 초기화됩니다.
        </p>
        {guard.saveError && <p className="text-danger mt-3 text-sm">{guard.saveError}</p>}
      </Modal>
    </>
  );
}
