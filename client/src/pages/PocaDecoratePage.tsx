import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImageOff, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useAuth } from '@/features/auth';
import { blobToBase64, useMyStickers, useUnusedStickers, type Sticker } from '@/features/sticker';
import {
  DecorateCanvas,
  StickerDrawer,
  composeDecorated,
  isOwner,
  newPlacedId,
  parsePlacements,
  serializePlacements,
  useDecoration,
  usePhotocardDetail,
  useSaveDecoration,
  PLACED_DEFAULT_SCALE,
  PLACED_MAX_COUNT,
  type Placed,
} from '@/features/nft';

/**
 * 포카 꾸미기 — 내 카드에 내가 만든 AI 스티커를 얹습니다.
 *
 * ── 이 화면이 지키는 것 ────────────────────────────────────
 * 🔴 **남의 카드는 들어올 수 없습니다.** 서버도 막지만 화면이 먼저 막습니다 —
 *    막지 않으면 주소창으로 남의 카드를 꾸며 가져가는 길이 열립니다.
 * 🔴 **저장에 실패해도 배치를 초기화하지 않습니다.** 20장 얹어 놓고 통신이 끊겼는데
 *    처음으로 돌아가면 다시 다 붙여야 합니다. 훅도 실패 시 아무것도 되돌리지 않습니다.
 * 🔴 합성은 **화면에 떠 있는 `<img>`** 로 합니다. 다시 받으면 presigned 가 만료돼 403 입니다
 *    (`composeDecorated` 주석).
 *
 * 기존 꾸밈이 있으면 배치를 복원해 **이어서 고칩니다.** 그때 스티커 그림 주소는 저장된
 * 것이 아니라 지금 내 스티커 목록에서 새로 찾습니다 (`parsePlacements`).
 */
export function PocaDecoratePage() {
  const { photocardId: raw = '' } = useParams();
  const photocardId = Number(raw);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: card, isPending, isError } = usePhotocardDetail(photocardId);
  /* 🔴 서랍에는 **안 쓴 것만** 옵니다. 스티커는 한 번 붙이면 뗄 수 없어서, 이미 쓴 것을
     보여주면 눌러도 서버가 거절하는 칸이 됩니다 (2026-09-23). */
  const stickers = useUnusedStickers();

  /* 🔴 **복원은 전체 목록으로 합니다.** 이미 붙인 스티커는 소모돼서 서랍 목록(unused)에
     없는데, 배치에는 stickerId 만 있고 그림 주소는 없습니다(만료되므로 저장하지 않습니다).
     전체 목록에서 찾지 않으면 **저장한 꾸밈이 화면에 안 그려집니다** — 실제로 그렇게 됐다가
     브라우저에서 잡았습니다. */
  const allStickers = useMyStickers();

  const mine = !!card && isOwner(card, user?.nickname);
  const decoration = useDecoration(photocardId, mine);
  const save = useSaveDecoration(photocardId);

  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 복원은 **한 번만**. 저장 뒤 캐시가 갱신돼도 지금 만지던 배치를 덮어쓰지 않습니다 */
  const [restored, setRestored] = useState(false);
  /* 합성(캔버스 → PNG)은 서버 요청 전이라 mutation 의 isPending 에 안 잡힙니다 */
  const [composing, setComposing] = useState(false);
  /** 카드 그림을 못 받았다 — 합성할 원본이 없으므로 저장이 불가능합니다 */
  const [cardBroken, setCardBroken] = useState(false);

  /* 합성에 쓸 실제 DOM 이미지들. 상태가 아니라 ref 입니다 — 바뀌어도 다시 그릴 일이 없습니다 */
  const cardImgRef = useRef<HTMLImageElement | null>(null);
  const stickerImgs = useRef(new Map<string, HTMLImageElement>());

  /* 내 카드가 아니면 상세로 되돌립니다. 기록을 교체해 뒤로가기로 되돌아오지 않게 합니다 */
  const notMine = !!card && !mine;
  useEffect(() => {
    if (notMine) navigate(ROUTES.NFT_DETAIL(raw), { replace: true });
  }, [notMine, navigate, raw]);

  /* 저장해 둔 배치 복원 — 스티커 목록이 있어야 그림 주소를 찾을 수 있습니다 */
  const decorationReady = mine && !decoration.isPending;
  const stickersReady = !stickers.isPending && !allStickers.isPending;
  const decorationData = decoration.data;
  const stickerList = allStickers.data;
  useEffect(() => {
    if (restored || !decorationReady || !stickersReady) return;
    if (decorationData) {
      const list = stickerList ?? [];
      /* 🔴 서버에서 받은 배치는 **전부 잠긴 것**입니다. 이미 소모돼 카드에 붙어 있어
         뗄 수도 옮길 수도 없습니다. 이번에 새로 얹는 것만 자유입니다 (2026-09-23). */
      setPlaced(
        parsePlacements(
          decorationData.placements,
          (id) => list.find((s: Sticker) => s.id === id)?.imageUrl,
        ).map((p) => ({ ...p, locked: true })),
      );
    }
    setRestored(true);
  }, [restored, decorationReady, stickersReady, decorationData, stickerList]);

  const invalidId = !Number.isInteger(photocardId) || photocardId <= 0;
  if (!invalidId && isPending) return <PageLoader />;
  if (invalidId || isError || !card) {
    return (
      <>
        <Header title="포카 꾸미기" showBack />
        <EmptyState icon={TriangleAlert} title="포토카드를 불러오지 못했어요" />
      </>
    );
  }
  /* 되돌리는 중 — 한 프레임 동안 남의 카드를 그리지 않습니다 */
  if (!mine) return <PageLoader />;

  /* 발행이 끝나지 않았거나 실패한 카드는 그림 자체가 없습니다 */
  if (!card.imageUrl) {
    return (
      <>
        <Header title="포카 꾸미기" showBack />
        <EmptyState
          icon={ImageOff}
          title="아직 꾸밀 수 없는 카드예요"
          description="카드 발행이 끝나면 꾸밀 수 있어요."
        />
      </>
    );
  }

  /** 탭한 스티커를 **맨 앞**으로 (배열 끝이 위) */
  const select = (id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    setPlaced((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(i, 1);
      return moved ? [...next, moved] : prev;
    });
  };

  const addSticker = (sticker: Sticker) => {
    if (placed.length >= PLACED_MAX_COUNT) return;
    const item: Placed = {
      id: newPlacedId(),
      stickerId: sticker.id,
      url: sticker.imageUrl,
      x: 0.5,
      y: 0.5,
      scale: PLACED_DEFAULT_SCALE,
      rotation: 0,
    };
    setPlaced((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const changeSticker = (id: string, patch: Partial<Placed>) =>
    setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removeSticker = (id: string) => {
    stickerImgs.current.delete(id);
    setPlaced((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const busy = composing || save.isPending;

  const onSave = async () => {
    const cardEl = cardImgRef.current;
    if (!cardEl || placed.length === 0) return;
    setComposing(true);
    try {
      const blob = await composeDecorated(cardEl, placed, stickerImgs.current);
      const imageBase64 = await blobToBase64(blob);
      save.mutate({ imageBase64, placements: serializePlacements(placed) });
    } catch {
      /* 대개 캔버스가 잠긴 경우입니다(그림 응답에 CORS 헤더가 없음).
         🔴 여기서도 배치를 건드리지 않습니다 — 사용자가 다시 누를 수 있어야 합니다. */
      toast.error('카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요');
    } finally {
      setComposing(false);
    }
  };

  /*
   * 🔴 "꾸밈 지우기" 는 **없앴습니다** (2026-09-23).
   *
   * 스티커는 한 번 붙이면 뗄 수 없는데 꾸밈을 통째로 지울 수 있으면 **그 스티커들이
   * 증발합니다.** 되돌릴 방법이 없는 소모라 지우는 길 자체를 두지 않습니다.
   * 서버의 DELETE 도 함께 없앴습니다.
   */

  return (
    <>
      <Header
        title="포카 꾸미기"
        showBack
      />

      <div className="px-4 py-5">
        <DecorateCanvas
          className="mx-auto max-w-64"
          imageUrl={card.imageUrl}
          designName={card.designName}
          placed={placed}
          selectedId={selectedId}
          onSelect={select}
          onChange={changeSticker}
          onRemove={removeSticker}
          registerCard={(el) => {
            cardImgRef.current = el;
          }}
          registerSticker={(id, el) => {
            if (el) stickerImgs.current.set(id, el);
            else stickerImgs.current.delete(id);
          }}
          onCardError={() => setCardBroken(true)}
        />

        {cardBroken && (
          <p className="text-danger mt-4 text-center text-sm">
            카드 그림을 불러오지 못했어요. 새로고침해 주세요.
          </p>
        )}

        {/* 하단 서랍 + 저장 버튼에 가리지 않게. `BottomBar.Spacer` 보다 서랍만큼 높습니다 */}
        <div aria-hidden className="h-[calc(16rem+env(safe-area-inset-bottom))]" />
      </div>

      <BottomBar className="space-y-3">
        <StickerDrawer
          stickers={stickers.data}
          isPending={stickers.isPending}
          isError={stickers.isError}
          placedCount={placed.length}
          onPick={addSticker}
          onCreate={() => navigate(ROUTES.STICKER_CREATE)}
        />
        <Button
          size="lg"
          fullWidth
          loading={busy}
          disabled={placed.length === 0 || cardBroken || busy}
          onClick={onSave}
        >
          {placed.length === 0 ? '스티커를 붙여 주세요' : '저장하기'}
        </Button>
      </BottomBar>
    </>
  );
}
