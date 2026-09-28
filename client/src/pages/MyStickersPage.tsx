import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useModal } from '@/app/providers';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  StickerGrid,
  useDeleteSticker,
  useUnusedStickers,
  type Sticker,
} from '@/features/sticker';

/**
 * 내 스티커 — 만든 것들의 격자. 삭제만 됩니다 (붙이는 화면은 1차 범위 밖, 설계 10장).
 * DONE 이 된 작업은 서버가 바로 스티커로 만들어 두므로 "저장" 버튼 없이 여기 쌓입니다.
 *
 * 🔴 **아직 안 쓴 것만 보입니다** (2026-09-23). 카드에 붙인 스티커는 목록에서 **사라집니다.**
 *    잠깐 흐리게 + "사용됨" 배지로 남겨 뒀다가 뺐습니다 — 다시 쓸 수 없는 칸이 계속 자리를
 *    차지하고, 스티커를 쓸수록 목록이 못 쓰는 것으로 채워집니다. 붙인 것은 카드에 있습니다.
 *
 * 🔴 **"포카 꾸미기" 의 입구입니다** (2026-09-22). 내 포토카드 머리말의 버튼이 여기로 옵니다.
 *    만든 스티커를 먼저 보여주고, "스티커 만들기" 로 그리기 화면에 들어갑니다.
 */
export function MyStickersPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { data: stickers, isPending, isError } = useUnusedStickers();
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
            스티커 만들기
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
            /* ⚠️ 목록이 **안 쓴 것만**이라 "아직 만든 게 없어요" 는 거짓이 될 수 있습니다 —
                다 써서 비었을 수도 있습니다. 두 경우에 다 맞는 말로 둡니다. */
            title="쓸 수 있는 스티커가 없어요"
            description="낙서 한 장이면 스티커가 됩니다."
            action={
              <Button variant="dark" onClick={() => navigate(ROUTES.STICKER_CREATE)}>
                스티커 만들기
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
