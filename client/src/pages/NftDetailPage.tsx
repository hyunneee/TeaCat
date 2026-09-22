import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Armchair, BadgeCheck, Coins, Hand, Layers, Sparkles, TriangleAlert } from 'lucide-react';
import { BottomBar, DetailHeader as Header } from '@/shared/components/layout';
import { Button, Card, Input, Segmented, Textarea } from '@/shared/components/ui';
import {
  AuctionTradePanel,
  useAuctionTrade,
  AuctionCreateForm,
  isRunning,
  useCreateAuction,
} from '@/features/auction';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ApiError, newIdempotencyKey } from '@/shared/api';
import { FEATURE, ROUTES } from '@/shared/constants';
import { formatDate } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  PhotocardDetailLayout,
  PhotocardInfo,
  FixedPricePanel,
  PocaCopyList,
  PocaCopyPicker,
  PocaLiveCard,
  PocaShowcase,
  PocaSpotlight,
  formatOrigin,
  isOwner,
  isSpecial,
  sellableCopies,
  mintStatusLabel,
  pocaSeed,
  useListPhotocard,
  useMyDesignCopies,
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

  const { data: card, isPending, isError, error } = usePhotocardDetail(photocardId);
  useRecordPhotocardView(photocardId, !!card);
  const trade = useAuctionTrade(card?.auction?.auctionId ?? 0);
  /* 같은 도안을 내가 몇 장 가졌나 — 도감이 한 칸으로 묶기 때문에 상세에서 펼쳐 줍니다.
     designId 는 상세 응답에서 오므로 상세보다 한 박자 늦게 채워집니다. */
  const { data: copies } = useMyDesignCopies(user ? card?.designId : undefined, card?.templateId);
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
  /* 🔴 **어느 장을 파는가.** 같은 그림이어도 파는 것은 특정한 한 장이고, 사용자는
     목록에서 본 다른 좌석·회차의 장을 팔 생각일 수 있습니다. null 이면 "지금 보는 장" 입니다. */
  const [sellTargetId, setSellTargetId] = useState<number | null>(null);
  useEffect(() => {
    setSelling(false);
    setSellTargetId(null);
    setPrice('');
    setDescription('');
  }, [photocardId]);
  const sellFormRef = useRef<HTMLSpanElement>(null);

  /*
   * 🔴 팔 장을 **이른 반환보다 위에서** 정합니다. 바로 아래 `useCreateAuction` 이 그 값을
   *    받아야 하는데 훅은 조건부 반환 뒤에 올 수 없습니다. 고정가와 경매가 서로 다른 장을
   *    파는 사고를 막으려면 두 길이 **같은 값 하나**를 봐야 합니다.
   */
  const allCopies = copies ?? [];
  const sellable = sellableCopies(allCopies);
  /* 고르지 않았으면 지금 보고 있는 장. 그 장을 팔 수 없으면(이미 판매 중) 팔 수 있는 첫 장 */
  const sellPhotocardId =
    sellTargetId ??
    (sellable.some((copy) => copy.photocardId === photocardId)
      ? photocardId
      : (sellable[0]?.photocardId ?? photocardId));
  const createAuction = useCreateAuction(sellPhotocardId);

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

  const mine =
    !!user &&
    (isOwner(card, user.nickname) || allCopies.some((copy) => copy.photocardId === photocardId));
  /* 내 카드가 아니면 보유 목록을 그리지 않습니다 — 남의 카드 화면에서 내 보유 장수를
     꺼내 보일 자리가 아닙니다(목록 자체는 내 것만 옵니다) */
  const myCopies = mine ? allCopies : [];
  /*
   * 스티커로 꾸민 그림이 있으면 그걸 보여줍니다.
   *
   * 🔴 **내 카드일 때만입니다.** 서버도 남의 카드에는 `decoratedImageUrl` 을 채우지 않지만,
   *    화면에서도 한 번 더 조입니다 — 마켓에서 꾸민 그림을 보고 산 사람이 받는 것은
   *    원본이라 속는 셈이 됩니다.
   */
  const shownImageUrl = (mine && card.decoratedImageUrl) || card.imageUrl;
  const listing = card.listing ?? null;
  const auction = card.auction ?? null;
  /* 모바일에 고정 버튼이 떠 있는가 — 아래 `BottomBar.Spacer` 주석 참고.
     경매 칸의 버튼은 **진행 중일 때만** 있고, 고정가·내 카드는 정산 중에도 안내 줄이 뜬다. */
  const hasMobileActionBar = auction ? isRunning(auction) : true;
  const settling = listing?.status === 'SETTLING' || auction?.status === 'SETTLING';
  /* 살 수 있는지 판단하는 기준도 **쓸 수 있는 금액**입니다.
     총액으로 판단하면 경매에 묶인 돈까지 셈에 넣어 "살 수 있다" 고 해놓고 서버가 거절합니다. */
  const balance = token?.available ?? 0;
  const affordable = listing?.status === 'ACTIVE' && balance >= listing.price;
  const mintLabel = mintStatusLabel(card.status);
  const canSubmitListing =
    sellable.some((copy) => copy.photocardId === sellPhotocardId) &&
    card.status === 'MINTED' &&
    Number(price) > 0 &&
    description.length <= 500;

  /*
   * 판매 등록이 끝난 뒤.
   *
   * 폼을 접는 이유: 나중에 판매를 내렸을 때 폼이 펼쳐진 채로 되살아나지 않게.
   * 🔴 **주소창의 장이 아닌 다른 장을 팔았으면 그 장으로 옮겨 줍니다.** 안 옮기면
   *    "판매 등록했어요" 토스트만 뜨고 화면은 안 판 카드를 그대로 보여줘서, 방금 한 일이
   *    실패한 것처럼 보입니다. 같은 그림이라 더 헷갈립니다.
   */
  const afterSell = (soldId: number) => {
    setSelling(false);
    setSellTargetId(null);
    if (soldId !== photocardId) navigate(ROUTES.NFT_DETAIL(String(soldId)), { replace: true });
  };

  return (
    <div className="flex flex-col">
      <Header title="포토카드" showBack />

      <PhotocardDetailLayout
        image={
          <>
            {mine ? (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                aria-label={`${card.designName} 포토카드 — 눌러서 크게 보기`}
                className="mx-auto block w-48 lg:w-full lg:max-w-72"
              >
                <PocaLiveCard
                  photocardId={card.photocardId}
                  designName={card.designName}
                  imageUrl={shownImageUrl}
                  glow={card.grade === undefined || isSpecial(card.grade)}
                  motes
                  className="aspect-[2/3] w-full"
                />
              </button>
            ) : (
              <PocaShowcase
                className="mx-auto w-48 lg:w-full lg:max-w-72"
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

            {/* 🔴 **내 카드일 때만** 보입니다. 이 화면은 마켓에서 들어온 **남의 카드도**
                그리기 때문에, 조건 없이 달면 남의 그림을 꾸며 가져가는 길이 열립니다.
                하단 초록 버튼(사기/팔기)과 겹치지 않게 `soft` 로 둡니다 — 한 화면의
                primary 는 하나입니다 (DESIGN.md 1장). */}
            {FEATURE.sticker && mine && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="soft"
                  leftIcon={<Sparkles size={16} />}
                  onClick={() => navigate(ROUTES.NFT_DECORATE(String(card.photocardId)))}
                >
                  스티커로 꾸미기
                </Button>
              </div>
            )}
          </>
        }
      >
        {/* 이름은 **판매 폼을 펼쳐도 남깁니다** — 무엇을 파는지가 안 보이는 채로
              가격을 적게 하면 안 됩니다. */}
        <PhotocardInfo card={card} ownedCount={myCopies.length} />
        {!selling && (
          <>
            {/* 경매 상세와 같은 쿼리·거래 패널을 재사용한다. */}
            {auction ? (
              <AuctionTradePanel
                onBid={(props) => open('auction/bid', props)}
                onConfirm={(props) => open('common/confirm', props)}
                trade={trade}
                showHeading={false}
                showCardLink={false}
                reserveBottomSpace={false}
              />
            ) : (
              <FixedPricePanel listing={listing} balance={balance} isMine={mine} />
            )}
            {/* 판매자가 남긴 설명 — 있을 때만.
              **가격 바로 아래**입니다. 값을 보고 "왜 이 값인지" 를 읽는 순서라,
              출처 안내(아래)보다 먼저 와야 합니다. */}
            {listing?.sellerDescription && (
              <div className="surface-2 space-y-1.5 rounded-2xl p-4">
                <p className="text-subtle text-sm font-semibold">판매자 설명</p>
                <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
                  {listing.sellerDescription}
                </p>
              </div>
            )}

            {/* 카드 출처와 근거(좌석·발행 시점)를 함께 표시합니다. */}
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

            {/*
                여러 장 가졌을 때만 — 각 장이 **어디서 온 것**인지.
                🔴 출처 블록 바로 아래입니다. 위에서 "이 카드는 어디서 왔나" 를 읽은 흐름
                   그대로 "나머지 두 장은 어디서 왔나" 로 이어집니다.
                ⚠️ 한 장뿐이면 위 출처 블록과 같은 말이 되므로 그리지 않습니다.
              */}
            {myCopies.length > 1 && (
              <div className="surface-2 space-y-1 rounded-2xl p-4">
                <p className="text-subtle flex items-center gap-1.5 text-sm font-semibold">
                  <Layers size={14} />
                  내가 가진 {myCopies.length}장
                </p>
                <PocaCopyList
                  copies={myCopies}
                  currentPhotocardId={card.photocardId}
                  onOpen={(id) => navigate(ROUTES.NFT_DETAIL(String(id)), { replace: true })}
                />
              </div>
            )}
          </>
        )}

        {/* 파는 방법이 둘이라 **한 카드 안에서 고릅니다.**
              폼을 둘 다 펼쳐 놓으면 초록 버튼이 두 개가 되어 어느 쪽이 지금 할 일인지
              알 수 없습니다 (DESIGN.md 1장 — 한 화면에 primary 는 하나). */}
        {mine && !listing && !auction && !settling && selling && (
          <Card className="space-y-3">
            <span ref={sellFormRef} aria-hidden className="block scroll-mt-24" />
            <p className="text-sm font-bold">판매 등록</p>

            {/*
                🔴 **어느 장을 팔지 먼저 고릅니다.** 같은 그림이어도 파는 것은 특정한 한 장이고,
                   위 목록에서 다른 좌석·회차의 장을 보고 내려온 사람은 그 장을 팔 생각입니다.
                   고르는 자리가 없으면 화면이 주소창의 장을 조용히 팔아 버립니다(QA 지적).
                여러 장 가졌을 때만 띄웁니다 — 한 장뿐이면 고를 것이 없습니다.
              */}
            {sellable.length > 1 && (
              <div className="space-y-2">
                <p className="text-subtle text-sm font-semibold">어느 장을 팔까요</p>
                <PocaCopyPicker
                  copies={sellable}
                  selectedPhotocardId={sellPhotocardId}
                  onSelect={setSellTargetId}
                />
              </div>
            )}

            <Segmented options={SELL_MODES} value={sellMode} onChange={setSellMode} />

            {sellMode === 'AUCTION' ? (
              <AuctionCreateForm
                isPending={createAuction.isPending}
                onSubmit={(values) =>
                  createAuction.mutate(values, {
                    /* 올린 뒤 "어디로 갔지" 를 찾게 하지 않습니다 —
                         만들어진 경매로 바로 보냅니다. 판매 등록 전 상세는 이미
                         유효한 단계가 아니므로 기록에서 교체해 뒤로가기로 되살리지 않습니다. */
                    onSuccess: (created) => {
                      setSellTargetId(null);
                      navigate(ROUTES.AUCTION_DETAIL(String(created.auctionId)), {
                        replace: true,
                      });
                    },
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
                  disabled={!canSubmitListing || list.isPending}
                  loading={list.isPending}
                  onClick={() =>
                    list.mutate(
                      {
                        /* 🔴 주소창의 장이 아니라 **고른 장**입니다 (sellPhotocardId 주석) */
                        photocardId: sellPhotocardId,
                        price: Number(price),
                        description: description.trim() || undefined,
                      },
                      { onSuccess: () => afterSell(sellPhotocardId) },
                    )
                  }
                >
                  판매 등록하기
                </Button>
              </>
            )}
          </Card>
        )}

        {/*
          모바일의 고정 거래 버튼이 출처·내 보유 카드의 마지막 행을 가리지 않도록 한다.
          🔴 **바가 떠 있을 때만** 비운다. 끝난 경매에는 고정 버튼이 없어서(입찰 패널이
             진행 중에만 그린다) 무조건 넣으면 화면 끝에 빈 띠가 남는다.
          경매 패널은 이 화면에서 `reserveBottomSpace={false}` 로 두고, 자리는 여기서
          한 번만 비운다 — 패널 안에서 비우면 아래 출처·보유 카드 블록 앞에 끼어 버린다.
        */}
        {hasMobileActionBar && <BottomBar.Spacer className="lg:hidden" />}

        {!auction && (
          <BottomBar inlineOnDesktop>
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
                disabled={(!!user && !affordable) || purchase.isPending}
                loading={purchase.isPending}
                leftIcon={<Coins size={18} />}
                onClick={() => {
                  if (!user) {
                    navigate(ROUTES.LOGIN, {
                      state: { from: ROUTES.NFT_DETAIL(String(photocardId)) },
                    });
                    return;
                  }
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
                {!user
                  ? '로그인하고 구매하기'
                  : affordable
                    ? `${listing.price.toLocaleString()} 캣머니로 바로 구매`
                    : '캣머니가 부족해요'}
              </Button>
            ) : (
              <p className="text-subtle text-center text-sm">판매 중이 아닙니다.</p>
            )}
          </BottomBar>
        )}
      </PhotocardDetailLayout>

      {/* 카드를 누르면 **뽑았을 때처럼** — 뒤에 빛이 돌고 이따금 휘리릭 뒤집힙니다 */}
      <PocaSpotlight
        open={zoomed}
        onClose={() => setZoomed(false)}
        photocardId={card.photocardId}
        designName={card.designName}
        imageUrl={shownImageUrl}
        group={card.group}
        grade={card.grade}
      />
    </div>
  );
}
