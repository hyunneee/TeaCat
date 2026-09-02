import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Armchair, BadgeCheck, Coins, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Card, Input, Textarea } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { formatDate } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  PocaFullscreen,
  PocaShowcase,
  useListNft,
  useNftDetail,
  usePurchaseNft,
  useUnlistNft,
} from '@/features/nft';
import { useTokenBalance } from '@/features/token';

/**
 * 포토카드 상세.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   카드 크게 → 이름·공연 → 가격 → 안내 → (본문) → 하단 고정 구매 버튼
 *
 * 카드가 상품이므로 **카드가 화면의 주인공**입니다. 회색 바닥 위에 올려
 * 실물 카드를 매대에서 집어 든 느낌을 냅니다.
 */
export function NftDetailPage() {
  const { nftId = '' } = useParams();
  const { open } = useModal();
  const { user } = useAuth();

  const { data: nft, isPending, isError } = useNftDetail(nftId);
  const { data: token } = useTokenBalance();
  const purchase = usePurchaseNft();
  const list = useListNft();
  const unlist = useUnlistNft();

  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [zoomed, setZoomed] = useState(false);

  if (isPending) return <PageLoader />;
  if (isError || !nft) {
    return (
      <>
        <Header title="포토카드" showBack />
        <EmptyState icon={TriangleAlert} title="포토카드를 불러오지 못했어요" />
      </>
    );
  }

  const mine = nft.ownerId === user?.id;
  const balance = token?.balance ?? 0;
  const affordable = nft.listPrice !== null && balance >= nft.listPrice;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="포토카드" showBack />

      <div className="flex-1">
        {/* 카드 무대 — 회색 바닥 위에 카드 하나 */}
        <div className="surface-2 border-line border-b px-6 py-8">
          

          {/* 들어올 때 사선으로 빛이 한 번 스칩니다.
              **내 카드만** 눌러서 전체화면으로 볼 수 있습니다 — 사러 온 화면에서는
              누를 것이 "구매" 하나여야 하고, 확대는 그 결정을 미루게 만듭니다. */}
          <PocaShowcase
            className="mx-auto w-48"
            seed={nft.artSeed}
            imageUrl={nft.imageUrl}
            alt={`${nft.name} 포토카드`}
            onOpen={mine ? () => setZoomed(true) : undefined}
          />
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-subtle text-[0.9375rem]">{nft.concertTitle}</p>
            <h1 className="text-xl leading-snug font-extrabold">{nft.name}</h1>
          </div>

          {/* 가격 — 이 화면에서 가장 먼저 읽혀야 하는 값 */}
          <div className="surface-2 rounded-2xl p-4">
            <p className="text-subtle text-sm">판매가</p>
            {nft.listPrice !== null ? (
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold tabular-nums">
                  {nft.listPrice.toLocaleString()}
                </span>
                <span className="text-ink-muted text-base font-bold">캣머니</span>
              </p>
            ) : (
              <p className="text-ink-muted mt-1 text-base font-medium">판매 중이 아닙니다</p>
            )}

            <p className="text-subtle mt-2 flex items-center gap-1.5 text-sm">
              <Coins size={15} className="shrink-0" />
              보유 {balance.toLocaleString()}캣머니
            </p>
          </div>

          {/* 판매자가 남긴 설명 — 있을 때만.
              **가격 바로 아래**입니다. 값을 보고 "왜 이 값인지" 를 읽는 순서라,
              출처 안내(아래)보다 먼저 와야 합니다. */}
          {nft.description && (
            <div className="surface-2 space-y-1.5 rounded-2xl p-4">
              <p className="text-subtle text-sm font-semibold">판매자 설명</p>
              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                {nft.description}
              </p>
            </div>
          )}

          {/* 출처 — 남의 물건을 사는 화면이라 신뢰 신호가 필요합니다.
              한 문장 + 그 근거(어느 좌석에서 언제)를 **한 덩어리**로 둡니다.
              표로 나누면 "좌석 / 발행일" 이 각각 무슨 뜻인지 다시 읽게 됩니다.
              소유자는 보여주지 않습니다 — 살지 말지에 영향을 주지 않는 값입니다. */}
          <div className="surface-2 flex gap-2.5 rounded-2xl p-4">
            <BadgeCheck size={19} className="text-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold">공연 좌석에서 발행된 카드입니다</p>
              <p className="text-muted mt-1 flex items-center gap-1.5 text-sm">
                <Armchair size={15} className="shrink-0" />
                <span className="truncate">
                  {nft.seatLabel} · {formatDate(nft.mintedAt)} 발행
                </span>
              </p>
            </div>
          </div>

          {mine && nft.listPrice === null && (
            <Card className="space-y-3">
              <p className="text-sm font-bold">판매 등록</p>
              <Input
                label="판매 가격"
                showRequirement
                required
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="캣머니 개수"
                inputMode="numeric"
                leftIcon={<Coins size={16} />}
                hint={`보유 캣머니 ${balance.toLocaleString()}개`}
              />
              {/* 설명은 선택입니다. 없으면 카드 상태를 물어보는 문의가 늘 뿐입니다. */}
              <Textarea
                label="설명"
                showRequirement
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="카드 상태나 거래 시 참고할 내용을 적어주세요."
                maxLength={200}
                showCount
                rows={3}
              />
              <Button
                fullWidth
                disabled={!price || Number(price) <= 0}
                loading={list.isPending}
                onClick={() =>
                  list.mutate({
                    nftId: nft.id,
                    price: Number(price),
                    description: description.trim() || undefined,
                  })
                }
              >
                판매 등록하기
              </Button>
            </Card>
          )}

          <BottomBar.Spacer />
        </div>
      </div>

      <BottomBar>
        {mine ? (
          nft.listPrice !== null ? (
            <Button
              variant="danger-ghost"
              size="lg"
              fullWidth
              loading={unlist.isPending}
              onClick={() =>
                open('common/confirm', {
                  title: '판매를 내릴까요?',
                  message: '마켓에서 사라지고, 다시 올리려면 가격을 새로 정해야 합니다.',
                  confirmText: '판매 내리기',
                  danger: true,
                  onConfirm: () => unlist.mutate(nft.id),
                })
              }
            >
              판매 내리기 ({nft.listPrice.toLocaleString()} 캣머니)
            </Button>
          ) : (
            <p className="text-subtle text-center text-sm">내가 보유한 포토카드입니다.</p>
          )
        ) : nft.listPrice !== null ? (
          <Button
            size="lg"
            fullWidth
            disabled={!affordable}
            loading={purchase.isPending}
            leftIcon={<Coins size={18} />}
            onClick={() =>
              open('common/confirm', {
                title: '이 포토카드를 구매할까요?',
                message: `${nft.listPrice?.toLocaleString()} 캣머니가 차감됩니다.`,
                confirmText: '구매',
                onConfirm: () => purchase.mutate(nft.id),
              })
            }
          >
            {affordable
              ? `${nft.listPrice.toLocaleString()} 캣머니로 바로 구매`
              : '캣머니가 부족해요'}
          </Button>
        ) : (
          <p className="text-subtle text-center text-sm">판매 중이 아닙니다.</p>
        )}
      </BottomBar>

      <PocaFullscreen
        open={zoomed}
        onClose={() => setZoomed(false)}
        seed={nft.artSeed}
        imageUrl={nft.imageUrl}
        name={nft.name}
        concertTitle={nft.concertTitle}
      />
    </div>
  );
}
