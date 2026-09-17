import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Armchair, BadgeCheck, Coins, Gavel, Hand, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Badge, Button, Card, Input, Segmented, Textarea } from '@/shared/components/ui';
import { AuctionCountdown, AuctionCreateForm, useCreateAuction } from '@/features/auction';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ApiError, newIdempotencyKey } from '@/shared/api';
import { ROUTES } from '@/shared/constants';
import { formatDate } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  PocaLiveCard,
  PocaShowcase,
  PocaSpotlight,
  formatOrigin,
  isOwner,
  isSpecial,
  mintStatusLabel,
  photocardSource,
  pocaName,
  pocaSeed,
  useListPhotocard,
  usePhotocardDetail,
  useRecordPhotocardView,
  usePurchasePhotocard,
  useUnlistPhotocard,
} from '@/features/nft';
import { useTokenBalance } from '@/features/token';

/** 파는 방법 — 값을 정해 바로 팔거나(고정가), 값을 겨루게 하거나(경매) */
type SellMode = 'FIXED' | 'AUCTION';

const SELL_MODES = [
  { value: 'FIXED', label: '고정가' },
  { value: 'AUCTION', label: '경매' },
] as const satisfies readonly { value: SellMode; label: string }[];

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
  const { photocardId: raw = '' } = useParams();
  const photocardId = Number(raw);
  const navigate = useNavigate();
  const { open } = useModal();
  const { user } = useAuth();
  const createAuction = useCreateAuction(photocardId);

  const { data: card, isPending, isError, error } = usePhotocardDetail(photocardId);
  useRecordPhotocardView(photocardId, !!card);
  const { data: token } = useTokenBalance();
  const purchase = usePurchasePhotocard();
  const list = useListPhotocard();
  const unlist = useUnlistPhotocard();

  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [sellMode, setSellMode] = useState<SellMode>('FIXED');
  const [zoomed, setZoomed] = useState(false);
  /* 판매 폼은 **누른 뒤에** 펼칩니다 — 내 카드를 보러 왔을 뿐인데 폼이 먼저 보이면
     이 화면이 "파는 화면" 으로 읽힙니다 */
  const [selling, setSelling] = useState(false);
  const sellFormRef = useRef<HTMLSpanElement>(null);

  /* 버튼은 화면 맨 아래에 있고 폼은 본문에 펼쳐집니다 —
     눌렀는데 아무 일도 안 일어난 것처럼 보이지 않게 폼으로 데려갑니다. */
  useEffect(() => {
    if (selling) sellFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selling]);

  /* 숫자가 아닌 id(`/nft/abc`)는 쿼리가 돌지 않아 isPending 이 영원히 true 입니다 — 먼저 걸러냅니다. */
  const invalidId = !Number.isInteger(photocardId) || photocardId <= 0;

  if (!invalidId && isPending) return <PageLoader />;
  if (invalidId || isError || !card) {
    /* 🔴 "없는 카드" 와 "불러오기 실패" 를 구분합니다.
       주소창에 아무 숫자나 넣어 들어온 사람에게 "불러오지 못했어요" 를 보여주면
       네트워크 장애처럼 읽혀서 새로고침만 반복하게 됩니다. 서버는 없는 포토카드에
       `NFT_001` 을 주므로 그때는 "없다" 고 분명히 말합니다. */
    const missing = invalidId || (ApiError.isApiError(error) && error.code === 'NFT_001');

    return (
      <>
        <Header title="포토카드" showBack />
        {missing ? (
          <EmptyState
            mood="sad"
            title="없는 포토카드예요"
            description="주소가 잘못됐거나 삭제된 카드입니다."
          />
        ) : (
          <EmptyState icon={TriangleAlert} title="포토카드를 불러오지 못했어요" />
        )}
      </>
    );
  }

  const mine = isOwner(card, user?.nickname);
  const listing = card.listing ?? null;
  const auction = card.auction ?? null;
  const settling = listing?.status === 'SETTLING' || auction?.status === 'SETTLING';
  /* 살 수 있는지 판단하는 기준도 **쓸 수 있는 금액**입니다.
     총액으로 판단하면 경매에 묶인 돈까지 셈에 넣어 "살 수 있다" 고 해놓고 서버가 거절합니다. */
  const balance = token?.available ?? 0;
  const affordable = listing?.status === 'ACTIVE' && balance >= listing.price;
  const mintLabel = mintStatusLabel(card.status);
  const canSubmitListing =
    card.status === 'MINTED' && Number(price) > 0 && description.length <= 500;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="포토카드" showBack />

      <div className="flex-1">
        {/* 카드 무대 — 회색 바닥 위에 카드 하나 */}
        <div className="surface-2 border-line border-b px-6 py-8">
          {/* 가만히 떠 있다가 이따금 휘리릭 돌고, 광택이 표면을 쓸고 지나갑니다.
              **내 카드만** 눌러서 크게 볼 수 있습니다 — 사러 온 화면에서는 누를 것이
              "구매" 하나여야 하고, 확대는 그 결정을 미루게 만듭니다. */}
          {mine ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label={`${card.designName} 포토카드 — 눌러서 크게 보기`}
              className="mx-auto block w-48"
            >
              <PocaLiveCard
                photocardId={card.photocardId}
                designName={card.designName}
                imageUrl={card.imageUrl}
                glow={card.grade === undefined || isSpecial(card.grade)}
                motes
                className="aspect-[2/3] w-full"
              />
            </button>
          ) : (
            <PocaShowcase
              className="mx-auto w-48"
              seed={pocaSeed(card.photocardId)}
              imageUrl={card.imageUrl}
              alt={`${card.designName} 포토카드`}
            />
          )}

          {/* 누를 수 있다는 걸 알려 줍니다 — 그림은 눌러도 눌리는 티가 안 납니다.
              누를 수 없는 남의 카드에는 띄우지 않습니다(거짓말이 됩니다). */}
          {mine && (
            <p className="text-subtle mt-4 flex items-center justify-center gap-1.5 text-sm">
              <Hand size={14} />
              카드를 눌러 자세히 봐요
            </p>
          )}
        </div>

        <div className="space-y-4 p-4">
          {/* 이름은 **판매 폼을 펼쳐도 남깁니다** — 무엇을 파는지가 안 보이는 채로
              가격을 적게 하면 안 됩니다. */}
          <div className="space-y-1">
            <h1 className="text-2xl leading-snug font-extrabold">{pocaName(card.designName)}</h1>
            {/* 어느 공연에서 얻은 카드인지 — 이름만 있으면 어디서 온 카드인지 알 수 없습니다 */}
            <p className="text-subtle text-[0.9375rem]">{photocardSource(card.performanceTitle)}</p>
          </div>

          {/* 나머지는 폼을 펼치면 감춥니다 — 가격·설명·출처를 그대로 둔 채 폼까지 얹으면
              화면이 길어져서 지금 채워야 할 칸이 어디인지 한눈에 안 들어옵니다. */}
          {!selling && (
            <>
              {/* 경매 중이면 가격 자리를 경매가 차지합니다.
              이 화면에서 입찰까지 받지는 않습니다 — 입찰은 경매 상세의 일이고,
              두 곳에서 받으면 폴링도 두 벌이 되고 현재가가 서로 어긋납니다. */}
              {auction ? (
                <div className="surface-2 space-y-3 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone={auction.status === 'SETTLING' ? 'quiet' : 'live'} size="md">
                      {auction.status === 'SETTLING' ? '거래 정산 중' : '경매 진행 중'}
                    </Badge>
                    <span className="text-subtle inline-flex items-center gap-0.5 text-sm">
                      <Gavel size={13} />
                      {auction.bidCount}
                    </span>
                  </div>

                  <div>
                    <p className="text-subtle text-sm">현재가</p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold tabular-nums">
                        {auction.currentPrice.toLocaleString()}
                      </span>
                      <span className="text-ink-muted text-base font-bold">캣머니</span>
                    </p>
                  </div>

                  {auction.status === 'ACTIVE' ? (
                    <div className="border-line flex items-center justify-between border-t pt-3">
                      <span className="text-muted text-sm">남은 시간</span>
                      <AuctionCountdown
                        endsAt={auction.endsAt}
                        className="text-sm font-extrabold"
                      />
                    </div>
                  ) : (
                    <p className="border-line text-subtle border-t pt-3 text-sm">
                      온체인 소유권 이전을 확인하고 있어요.
                    </p>
                  )}

                  <Button
                    fullWidth
                    leftIcon={<Gavel size={17} />}
                    onClick={() =>
                      navigate(ROUTES.AUCTION_DETAIL(String(auction.auctionId)), {
                        /* 포카 상세와 경매 상세를 왕복하며 같은 두 화면이 기록에
                           계속 쌓이지 않게 현재 상세 단계를 경매 상세로 교체합니다. */
                        replace: true,
                      })
                    }
                  >
                    경매 보러 가기
                  </Button>
                </div>
              ) : (
                /* 가격 — 이 화면에서 가장 먼저 읽혀야 하는 값 */
                <div className="surface-2 rounded-2xl p-4">
                  <p className="text-subtle text-sm">판매가</p>
                  {listing ? (
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold tabular-nums">
                        {listing.price.toLocaleString()}
                      </span>
                      <span className="text-ink-muted text-base font-bold">캣머니</span>
                    </p>
                  ) : (
                    <p className="text-ink-muted mt-1 text-base font-medium">판매 중이 아닙니다</p>
                  )}

                  {listing?.status === 'SETTLING' && (
                    <p className="text-subtle mt-2 text-sm">
                      온체인 소유권 이전을 확인하고 있어요.
                    </p>
                  )}

                  <p className="text-subtle mt-2 flex items-center gap-1.5 text-sm">
                    <Coins size={15} className="shrink-0" />
                    보유 {balance.toLocaleString()}캣머니
                  </p>
                </div>
              )}

              {/* 판매자가 남긴 설명 — 있을 때만.
              **가격 바로 아래**입니다. 값을 보고 "왜 이 값인지" 를 읽는 순서라,
              출처 안내(아래)보다 먼저 와야 합니다. */}
              {listing?.sellerDescription && (
                <div className="surface-2 space-y-1.5 rounded-2xl p-4">
                  <p className="text-subtle text-sm font-semibold">판매자 설명</p>
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                    {listing.sellerDescription}
                  </p>
                </div>
              )}

              {/* 출처 — 남의 물건을 사는 화면이라 신뢰 신호가 필요합니다.
              한 문장 + 그 근거(어느 좌석에서 언제)를 **한 덩어리**로 둡니다.
              소유자는 보여주지 않습니다 — 살지 말지에 영향을 주지 않는 값입니다. */}
              <div className="surface-2 flex gap-2.5 rounded-2xl p-4">
                <BadgeCheck size={19} className="text-ink-muted mt-0.5 shrink-0" />
                <div className="min-w-0">
                  {/* 🔴 뽑기로 얻은 카드는 좌석이 없습니다(origin: null).
                      한 문장으로 뭉뚱그리지 않고 어디서 온 카드인지 그대로 말해 줍니다. */}
                  <p className="text-[0.9375rem] font-semibold">
                    {card.origin
                      ? '공연 좌석에서 발행된 카드입니다'
                      : '이벤트 카드팩에서 나온 카드입니다'}
                  </p>
                  <p className="text-muted mt-1 flex items-center gap-1.5 text-sm">
                    {card.origin && <Armchair size={15} className="shrink-0" />}
                    <span className="truncate">
                      {card.origin && `${formatOrigin(card.origin)} · `}
                      {formatDate(card.issuedAt)} 발행
                    </span>
                  </p>
                  {/* 발행이 끝나지 않은 카드에만 한 줄 (MINTED 면 null) */}
                  {mintLabel && <p className="text-subtle mt-1 text-sm">{mintLabel}</p>}
                </div>
              </div>
            </>
          )}

          {/* 파는 방법이 둘이라 **한 카드 안에서 고릅니다.**
              폼을 둘 다 펼쳐 놓으면 초록 버튼이 두 개가 되어 어느 쪽이 지금 할 일인지
              알 수 없습니다 (DESIGN.md 1장 — 한 화면에 primary 는 하나). */}
          {mine && !listing && !auction && !settling && selling && (
            <Card className="space-y-3">
              <span ref={sellFormRef} aria-hidden className="block scroll-mt-24" />
              <p className="text-sm font-bold">판매 등록</p>
              <Segmented options={SELL_MODES} value={sellMode} onChange={setSellMode} />

              {sellMode === 'AUCTION' ? (
                <AuctionCreateForm
                  isPending={createAuction.isPending}
                  onSubmit={(values) =>
                    createAuction.mutate(values, {
                      /* 올린 뒤 "어디로 갔지" 를 찾게 하지 않습니다 —
                         만들어진 경매로 바로 보냅니다. 판매 등록 전 상세는 이미
                         유효한 단계가 아니므로 기록에서 교체해 뒤로가기로 되살리지 않습니다. */
                      onSuccess: (created) =>
                        navigate(ROUTES.AUCTION_DETAIL(String(created.auctionId)), {
                          replace: true,
                        }),
                    })
                  }
                />
              ) : (
                <>
                  <Input
                    label="판매 가격"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    placeholder="캣머니 개수"
                    inputMode="numeric"
                    leftIcon={<Coins size={16} />}
                    hint={`보유 캣머니 ${balance.toLocaleString()}개`}
                  />
                  <Textarea
                    label="판매 설명"
                    showRequirement
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    placeholder="카드 상태나 거래 관련 설명을 입력해 주세요."
                    hint={`${description.length}/500자`}
                    rows={3}
                  />
                  {/* 값을 정할 기준 — 같은 도안이 지금까지 얼마에 거래됐는지.
                      기준이 없으면 아무 숫자나 적게 되고, 그 값이 다시 다음 사람의 기준이 됩니다. */}
                  {card.averagePrice ? (
                    <div className="surface-2 flex items-center justify-between rounded-xl px-3.5 py-3">
                      <span className="text-subtle text-sm">지금까지 거래 평균</span>
                      <span className="text-[0.9375rem] font-bold tabular-nums">
                        {card.averagePrice.toLocaleString()}
                        <span className="text-ink-muted ml-1 text-xs font-semibold">캣머니</span>
                      </span>
                    </div>
                  ) : (
                    <p className="surface-2 text-subtle rounded-xl px-3.5 py-3 text-center text-sm">
                      아직 거래된 적이 없는 카드에요.
                    </p>
                  )}
                  <Button
                    fullWidth
                    disabled={!canSubmitListing}
                    loading={list.isPending}
                    onClick={() =>
                      list.mutate(
                        {
                          photocardId: card.photocardId,
                          price: Number(price),
                          description: description.trim() || undefined,
                        },
                        /* 등록되면 폼을 접습니다 — 나중에 판매를 내렸을 때 폼이
                           펼쳐진 채로 되살아나지 않게 */
                        { onSuccess: () => setSelling(false) },
                      )
                    }
                  >
                    판매 등록하기
                  </Button>
                </>
              )}
            </Card>
          )}

          {/* 경매 중이면 하단 바가 없습니다 — 눌러야 할 것은 위 경매 블록의 "경매 보러 가기" 하나입니다 */}
          {!auction && <BottomBar.Spacer />}
        </div>
      </div>

      {!auction && (
        <BottomBar>
          {settling ? (
            <p className="text-subtle text-center text-sm">
              거래 정산 중입니다. 완료되면 자동으로 갱신돼요.
            </p>
          ) : mine ? (
            listing ? (
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
                    onConfirm: () => unlist.mutate(card.photocardId),
                  })
                }
              >
                판매 내리기 ({listing.price.toLocaleString()} 캣머니)
              </Button>
            ) : selling ? (
              /* 폼이 펼쳐져 있는 동안은 여기서 초록 버튼을 빼야 합니다 —
                 지금 눌러야 할 것은 폼 안의 "판매 등록하기" 하나입니다 (DESIGN.md 1장) */
              <Button variant="outline" size="lg" fullWidth onClick={() => setSelling(false)}>
                판매 그만두기
              </Button>
            ) : (
              <Button
                size="lg"
                fullWidth
                disabled={card.status !== 'MINTED'}
                onClick={() => setSelling(true)}
              >
                {card.status === 'MINTED' ? '판매하기' : '발행 완료 후 판매할 수 있어요'}
              </Button>
            )
          ) : listing ? (
            <Button
              size="lg"
              fullWidth
              disabled={!affordable}
              loading={purchase.isPending}
              leftIcon={<Coins size={18} />}
              onClick={() => {
                /* 멱등키는 **모달을 열 때** 한 번 만듭니다. 확인을 두 번 누르거나 네트워크가
                 끊겨 재시도돼도 같은 키가 가서 서버가 한 번만 체결합니다. */
                const idempotencyKey = newIdempotencyKey();
                open('common/confirm', {
                  title: '이 포토카드를 구매할까요?',
                  message: `${listing.price.toLocaleString()} 캣머니가 차감됩니다.`,
                  confirmText: '구매',
                  onConfirm: () =>
                    purchase.mutate({ photocardId: card.photocardId, idempotencyKey }),
                });
              }}
            >
              {affordable
                ? `${listing.price.toLocaleString()} 캣머니로 바로 구매`
                : '캣머니가 부족해요'}
            </Button>
          ) : (
            <p className="text-subtle text-center text-sm">판매 중이 아닙니다.</p>
          )}
        </BottomBar>
      )}

      {/* 카드를 누르면 **뽑았을 때처럼** — 뒤에 빛이 돌고 이따금 휘리릭 뒤집힙니다 */}
      <PocaSpotlight
        open={zoomed}
        onClose={() => setZoomed(false)}
        photocardId={card.photocardId}
        designName={card.designName}
        imageUrl={card.imageUrl}
        group={card.group}
        grade={card.grade}
      />
    </div>
  );
}
