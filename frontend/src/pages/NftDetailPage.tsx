import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Armchair, Coins, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Badge, Button, Card, Input } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { formatDateTime } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  PocaArt,
  RARITY_LABEL,
  rarityTone,
  useListNft,
  useNftDetail,
  usePurchaseNft,
  useTokenBalance,
  useUnlistNft,
} from '@/features/nft';

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
      <Header title={nft.name} showBack />

      <div className="flex-1 space-y-4 p-4">
        <div className="mx-auto w-52">
          <PocaArt
            seed={nft.artSeed}
            rarity={nft.rarity}
            imageUrl={nft.imageUrl}
            alt={`${nft.name} 포토카드`}
          />
        </div>

        <div className="space-y-2 text-center">
          <Badge tone={rarityTone(nft.rarity)}>{RARITY_LABEL[nft.rarity]}</Badge>
          <h1 className="text-xl font-extrabold">{nft.name}</h1>
          <p className="text-muted text-sm">{nft.concertTitle}</p>
        </div>

        <Card className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted flex items-center gap-1.5">
              <Armchair size={14} /> 발행 좌석
            </span>
            <span className="font-medium">{nft.seatLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">소유자</span>
            <span className="font-medium">{mine ? '나' : nft.ownerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">발행일</span>
            <span className="font-medium">{formatDateTime(nft.mintedAt)}</span>
          </div>
        </Card>

        {mine && nft.listPrice === null && (
          <Card className="space-y-3">
            <p className="text-sm font-bold">판매 등록</p>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="판매 가격"
              inputMode="numeric"
              leftIcon={<Coins size={16} />}
              hint={`보유 토큰 ${balance.toLocaleString()}`}
            />
            <Button
              fullWidth
              disabled={!price || Number(price) <= 0}
              loading={list.isPending}
              onClick={() => list.mutate({ nftId: nft.id, price: Number(price) })}
            >
              판매 등록하기
            </Button>
          </Card>
        )}

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        {mine ? (
          nft.listPrice !== null ? (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={unlist.isPending}
              onClick={() => unlist.mutate(nft.id)}
            >
              판매 내리기 ({nft.listPrice.toLocaleString()} 토큰)
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
                message: `${nft.listPrice?.toLocaleString()} 토큰이 차감됩니다.`,
                confirmText: '구매',
                onConfirm: () => purchase.mutate(nft.id),
              })
            }
          >
            {affordable
              ? `${nft.listPrice.toLocaleString()} 토큰으로 구매`
              : '보유 토큰이 부족해요'}
          </Button>
        ) : (
          <p className="text-subtle text-center text-sm">판매 중이 아닙니다.</p>
        )}
      </BottomBar>
    </div>
  );
}
