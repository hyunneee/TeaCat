import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Check } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { FEATURE, ROUTES } from '@/shared/constants';
import {
  DEX_ROLE_ALL,
  DEX_ROLE_OPTIONS,
  PocaDexCard,
  NftCard,
  photocardMarketState,
  filterOwnedCards,
  PocaPackTile,
  dexProgress,
  filterPocaDex,
  groupLockedPacks,
  useDrawAvailability,
  useOwnedCards,
  usePocaDex,
  type DexRoleFilter,
} from '@/features/nft';

/**
 * 내 포토카드 — **도감**.
 *
 * 가진 것만 늘어놓으면 "뭘 더 모아야 하는지" 를 알 수 없어서, 공개된 이벤트·공연의 카드를
 * 모두 깔고 그 위에 내가 가진 것을 얹습니다. 안 가진 칸은 물음표와 획득처만 보여 주며 서버도
 * 그 칸의 이름과 그림 URL을 보내지 않습니다.
 *
 * 보유 카드만 선택하면 풀과 관계없이 개별 카드 목록을 표시합니다.
 */
export function MyNftsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<DexRoleFilter>(DEX_ROLE_ALL);
  const [ownedOnly, setOwnedOnly] = useState(true);

  const { entries, isPending, isError } = usePocaDex();
  /* 🔴 카드 한 장 한 장은 "보유 카드만" 을 켰을 때만 받습니다. 도감은 전용 응답 한 번이면 그려지고,
     끄고 있는 동안에는 이 목록 요청이 **아예 나가지 않습니다.** */
  const { cards, cardsPending, cardsError } = useOwnedCards(ownedOnly);

  /* 카드팩은 **서버가 남았다고 할 때만** 보입니다 — 다 쓴 팩이 남아 있으면
     눌러도 실패하는 칸이 됩니다. 응답 전에는 보여주지 않습니다(깜빡임 방지). */
  const { data: draw } = useDrawAvailability();
  const lockedGroups = groupLockedPacks(draw);

  const filtered = filterPocaDex(entries, { keyword, role });
  const visible = filtered;
  const ownedCards = filterOwnedCards(cards, { keyword, role });
  const loading = ownedOnly ? cardsPending : isPending;
  const failed = ownedOnly ? cardsError : isError;
  /*
   * 진행도는 **역할 드롭다운을 따라가고 검색어는 무시합니다.**
   *
   * 역할은 "코치를 몇 명 모았나" 라는 셈이 그대로 성립하는 묶음이라, 걸러도 분모가
   * 뜻을 가집니다. 반면 검색어는 한 글자 칠 때마다 분모가 바뀌어서(21 → 7 → 2 → 1)
   * 숫자가 튀는 것으로만 보입니다 — 무엇을 세는 중인지 알 수 없습니다.
   */
  const progress = dexProgress(filterPocaDex(entries, { role }));

  /*
   * 카드팩을 그릴지.
   *
   * 🔴 **보유 화면에 둡니다.** 팩은 "아직 안 깐 내 소유물" 이고, 도감은 어떤 도안이
   * 있는지 보는 목록이라 소유물이 낄 자리가 아닙니다. 팩을 받은 직후 모달의
   * "보러 가기" 도 이 화면으로 보냅니다(`PocaPackGotModal`).
   *
   * 검색어·역할 필터 중에는 감춥니다 — 거른 결과에 팩이 끼면 검색 결과로 읽힙니다.
   *
   * ⚠️ 예전에는 이 판단이 `searching` 하나였고 거기에 `ownedOnly` 가 섞여 있었습니다.
   *    `ownedOnly` 기본값이 true 라 **기본 화면에서 팩이 한 번도 보이지 않았고**,
   *    "전체 보기" 를 눌러야 나타나는 정반대 동작이었습니다. `ownedOnly` 는 필터가
   *    아니라 보기 모드라 같은 자리에 두면 안 됩니다.
   */
  const filtering = keyword.trim().length > 0 || role !== DEX_ROLE_ALL;
  const showPacks = ownedOnly && !filtering;

  return (
    <>
      {/* 포카 꾸미기(AI 스티커) 진입점은 이 버튼 하나입니다 (구현 계획 1-3).
          `FEATURE.sticker` 가 꺼지면 버튼도 라우트도 없습니다. */}
      <Header
        title="내 포토카드"
        right={
          FEATURE.sticker ? (
            <Button
              variant="soft"
              size="sm"
              leftIcon={<Sparkles size={15} />}
              onClick={() => navigate(ROUTES.STICKER_CREATE)}
            >
              포카 꾸미기
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 pt-2 pb-4 lg:px-0 lg:pt-3">
        {/* 모든 화면에서 왼쪽 역할 필터·오른쪽 검색 순서를 유지한다. */}
        <div className="mb-4 flex items-center gap-2 lg:gap-3">
          <Select
            label="역할"
            variant="field"
            align="left"
            options={DEX_ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            className="w-28 shrink-0"
          />
          <div className="min-w-0 flex-1 lg:ml-auto lg:w-full lg:max-w-xs lg:flex-none">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onClear={() => setKeyword('')}
              placeholder="카드 이름, 소속, 획득처로 검색"
              leftIcon={<Search size={17} />}
              type="search"
              tone="contrast"
            />
          </div>
        </div>

        <>
          {/* 얼마나 모았는지가 이 화면의 첫 문장입니다 */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted">
              {loading ? (
                '불러오는 중'
              ) : failed ? (
                '조회 실패'
              ) : ownedOnly ? (
                <>
                  보유 <span className="text-ink font-bold tabular-nums">{ownedCards.length}</span>
                  장
                </>
              ) : (
                <>
                  <span className="text-ink font-bold tabular-nums">{progress.owned}</span>
                  <span className="tabular-nums"> / {progress.total}</span> 종 모았어요
                </>
              )}
            </p>
            <label className="ml-auto flex min-h-8 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={!ownedOnly}
                onChange={(event) => setOwnedOnly(!event.target.checked)}
                className="peer sr-only"
              />
              <span className="text-ink-muted peer-checked:text-accent-800 peer-focus-visible:outline-brand-900 flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                <Check
                  size={15}
                  aria-hidden="true"
                  className={`shrink-0 transition-colors ${!ownedOnly ? 'text-accent-800' : 'text-ink-subtle'}`}
                />
                전체 보기
              </span>
            </label>
          </div>

          {loading ? (
            <Loading label={ownedOnly ? '보유 카드를 불러오는 중' : '도감을 불러오는 중'} />
          ) : failed ? (
            <EmptyState
              title="카드를 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-4">
                {/* 카드팩이 맨 앞 — 목록 밖에 배너처럼 두면 광고로 읽힙니다.
                  🔴 열 수 있는 팩과 잠긴 팩을 **따로** 그립니다. 한 칸으로 합치면
                  "1개는 열 수 있고 2개는 기다린다" 가 "1개뿐" 으로 보입니다.
                  ⚠️ 보유 화면에서만, 검색·필터 중에는 감춥니다 (`showPacks` 주석). */}
                {showPacks && draw && draw.remaining > 0 && (
                  <li>
                    <PocaPackTile
                      count={draw.remaining}
                      onClick={() => navigate(ROUTES.NFT_DRAW)}
                    />
                  </li>
                )}
                {showPacks && draw && draw.preparing > 0 && (
                  <li>
                    <PocaPackTile count={draw.preparing} preparing onClick={() => undefined} />
                  </li>
                )}
                {/* 잠긴 팩은 **개봉 시각별로** 한 칸씩 — 서버가 팩마다 시각을 줍니다.
                    목록이 잘렸거나 옛 서버면(null) 예전처럼 한 칸으로 물러섭니다. */}
                {showPacks &&
                  draw &&
                  draw.scheduled > 0 &&
                  (lockedGroups ?? [{ openAt: draw.nextOpenAt, count: draw.scheduled }]).map(
                    (group) => (
                      <li key={group.openAt ?? 'locked'}>
                        <PocaPackTile
                          count={group.count}
                          openAt={group.openAt}
                          onClick={() => navigate(ROUTES.NFT_DRAW)}
                        />
                      </li>
                    ),
                  )}

                {ownedOnly
                  ? ownedCards.map((card) => (
                      <li key={card.photocardId}>
                        <NftCard
                          photocardId={card.photocardId}
                          designName={card.designName}
                          imageUrl={card.imageUrl}
                          performanceTitle={card.performanceTitle}
                          eventName={card.eventName}
                          state={photocardMarketState(card)}
                          onClick={() => navigate(ROUTES.NFT_DETAIL(String(card.photocardId)))}
                        />
                      </li>
                    ))
                  : visible.map((entry) => (
                      <li key={entry.designId}>
                        <PocaDexCard
                          entry={entry}
                          onOpen={(photocardId) => navigate(ROUTES.NFT_DETAIL(String(photocardId)))}
                        />
                      </li>
                    ))}
              </ul>

              {(ownedOnly ? ownedCards.length === 0 : visible.length === 0) && (
                <EmptyState
                  icon={Search}
                  title="찾는 카드가 없어요"
                  description={
                    ownedOnly
                      ? '전체 보기를 선택하거나 다른 이름·역할로 찾아보세요.'
                      : '다른 이름이나 역할로 찾아보세요.'
                  }
                />
              )}
            </>
          )}
        </>
      </div>
    </>
  );
}
