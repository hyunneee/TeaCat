import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useModal } from '@/app/providers';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { StickerGrid, useDeleteSticker, useMyStickers, type Sticker } from '@/features/sticker';

/**
 * 내 스티커 — 만든 것들의 격자. 삭제만 됩니다 (붙이는 화면은 1차 범위 밖, 설계 10장).
 * DONE 이 된 작업은 서버가 바로 스티커로 만들어 두므로 "저장" 버튼 없이 여기 쌓입니다.
 */
export function MyStickersPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { data: stickers, isPending, isError } = useMyStickers();
  const remove = useDeleteSticker();

  /* 삭제는 되돌릴 수 없는 동작 → 확인 모달 (CLAUDE.md 4-7) */
  const confirmDelete = (s: Sticker) =>
    open('common/confirm', {
      title: '이 스티커를 지울까요?',
      message: '지운 스티커는 되돌릴 수 없어요.',
      confirmText: '지우기',
      danger: true,
      onConfirm: () => remove.mutate(s.id),
    });

  return (
    <>
      <Header
        title="내 스티커"
        showBack
        right={
          <Button
            variant="soft"
            size="sm"
            leftIcon={<Sparkles size={15} />}
            onClick={() => navigate(ROUTES.STICKER_CREATE)}
          >
            새로 만들기
          </Button>
        }
      />

      <div className="p-4">
        {isPending ? (
          <Loading label="스티커를 불러오는 중" />
        ) : isError ? (
          <EmptyState title="스티커를 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." />
        ) : !stickers || stickers.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="아직 만든 스티커가 없어요"
            description="낙서 한 장이면 스티커가 됩니다."
            action={
              <Button variant="dark" onClick={() => navigate(ROUTES.STICKER_CREATE)}>
                포카 꾸미기
              </Button>
            }
          />
        ) : (
          <StickerGrid
            stickers={stickers}
            onDelete={confirmDelete}
            deletingId={remove.isPending ? remove.variables : null}
          />
        )}
      </div>
    </>
  );
}
