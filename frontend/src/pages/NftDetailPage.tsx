import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Armchair, BadgeCheck, Grape, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Card, Input, Textarea } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { formatDateTime } from '@/shared/lib';
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
          <p className="text-subtle mb-6 text-center text-[0.8125rem] leading-relaxed">
            카드 이미지는 실물 확인을 돕기 위한 것입니다.
            <br />
            화면과 실제 카드는 색이 조금 다를 수 있어요.
          </p>

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
                <span className="text-ink-muted text-base font-bold">포도알</span>
              </p>
            ) : (
              <p className="text-ink-muted mt-1 text-base font-medium">판매 중이 아닙니다</p>
            )}

            <p className="text-subtle mt-2 flex items-center gap-1.5 text-sm">
              <Grape size={15} className="shrink-0" />
              보유 {balance.toLocaleString()}포도알
            </p>
          </div>

          {/* 검수 안내 — 남의 물건을 사는 화면이라 신뢰 신호가 필요합니다 */}
          <div className="surface-2 flex gap-2.5 rounded-2xl p-4">
            <BadgeCheck size={19} className="text-ink-muted mt-0.5 shrink-0" />
            <p className="text-ink-muted text-sm leading-relaxed">
              <b className="text-ink">공연 좌석에서 발행된 카드</b>입니다. 발행 기록이 남아 있어
              같은 카드가 두 번 나올 수 없어요.
            </p>
          </div>

          {/* 테두리로 가두지 않습니다. 세 줄뿐이라 여백만으로 충분히 묶여 보입니다. */}
          <dl className="space-y-3 px-1 text-[0.9375rem]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted flex shrink-0 items-center gap-1.5">
                <Armchair size={16} /> 발행 좌석
              </dt>
              <dd className="truncate font-semibold">{nft.seatLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted shrink-0">소유자</dt>
              <dd className="truncate font-semibold">{mine ? '나' : nft.ownerName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted shrink-0">발행일</dt>
              <dd className="truncate font-semibold">{formatDateTime(nft.mintedAt)}</dd>
            </div>
          </dl>

          {/* 판매자가 남긴 설명 — 있을 때만 */}
          {nft.description && (
            <div className="surface-2 space-y-1.5 rounded-2xl p-4">
              <p className="text-subtle text-sm font-semibold">판매자 설명</p>
              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                {nft.description}
              </p>
            </div>
          )}

          {mine && nft.listPrice === null && (
            <Card className="space-y-3">
              <p className="text-sm font-bold">판매 등록</p>
              <Input
                label="판매 가격"
                showRequirement
                required
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="포도알 개수"
                inputMode="numeric"
                leftIcon={<Grape size={16} />}
                hint={`보유 포도알 ${balance.toLocaleString()}개`}
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
              판매 내리기 ({nft.listPrice.toLocaleString()} 포도알)
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
            leftIcon={<Grape size={18} />}
            onClick={() =>
              open('common/confirm', {
                title: '이 포토카드를 구매할까요?',
                message: `${nft.listPrice?.toLocaleString()} 포도알이 차감됩니다.`,
                confirmText: '구매',
                onConfirm: () => purchase.mutate(nft.id),
              })
            }
          >
            {affordable
              ? `${nft.listPrice.toLocaleString()} 포도알로 바로 구매`
              : '포도알이 부족해요'}
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
