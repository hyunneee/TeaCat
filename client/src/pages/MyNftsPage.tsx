import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  DEX_ROLE_ALL,
  DEX_ROLE_OPTIONS,
  PocaDexCard,
  PocaPackTile,
  dexProgress,
  filterPocaDex,
  useDrawAvailability,
  usePocaDex,
  type DexRoleFilter,
} from '@/features/nft';

/**
 * 내 포토카드 — **도감**.
 *
 * 가진 것만 늘어놓으면 "뭘 더 모아야 하는지" 를 알 수 없어서, 뽑기에 나오는 카드 전체를
 * 깔고 그 위에 내가 가진 것을 얹습니다. 안 가진 칸은 물음표로 자리만 지킵니다
 * (`PocaDexCard` 주석 — 그림을 아예 받지 않습니다).
 *
 * ⚠️ **공연 좌석에서 나온 카드는 도감에 없습니다.** 도감의 바탕이 뽑기 풀 도안이라서입니다 —
 * 공연 카드까지 깔면 아직 열리지 않은 공연의 카드가 미리 보이고, 역할(코치·교육생·개발자)
 * 꼬리표도 뽑기 풀 도안에만 붙어 거를 방법이 없습니다.
 */
export function MyNftsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<DexRoleFilter>(DEX_ROLE_ALL);

  const { entries, isPending, isError } = usePocaDex();

  /* 카드팩은 **서버가 남았다고 할 때만** 보입니다 — 다 쓴 팩이 남아 있으면
     눌러도 실패하는 칸이 됩니다. 응답 전에는 보여주지 않습니다(깜빡임 방지). */
  const { data: draw } = useDrawAvailability();

  const visible = filterPocaDex(entries, { keyword, role });
  /*
   * 진행도는 **역할 드롭다운을 따라가고 검색어는 무시합니다.**
   *
   * 역할은 "코치를 몇 명 모았나" 라는 셈이 그대로 성립하는 묶음이라, 걸러도 분모가
   * 뜻을 가집니다. 반면 검색어는 한 글자 칠 때마다 분모가 바뀌어서(21 → 7 → 2 → 1)
   * 숫자가 튀는 것으로만 보입니다 — 무엇을 세는 중인지 알 수 없습니다.
   */
  const progress = dexProgress(filterPocaDex(entries, { role }));
  const searching = keyword.trim().length > 0 || role !== DEX_ROLE_ALL;

  return (
    <>
      <Header title="내 포토카드" />

      <div className="p-4 lg:mx-auto lg:max-w-3xl lg:px-0 lg:pt-4">
        {/* 🔴 검색창과 드롭다운을 **같은 높이의 한 벌**로 둡니다. 예전에는 Select 가
            글자 버튼(약 28px)이라 48px 입력 옆에서 위아래가 안 맞고, 입력이 `flex-1` 도
            아니어서 오른쪽에 빈 자리가 남았습니다 (QA: "한쪽으로 쏠리고 여백도 있다").
            입력이 남은 폭을 다 먹고, 드롭다운은 글자가 잘리지 않을 만큼만 차지합니다. */}
        <div className="mb-4 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onClear={() => setKeyword('')}
              placeholder="카드 이름, 소속으로 검색"
              leftIcon={<Search size={17} />}
              type="search"
              tone="contrast"
            />
          </div>
          <Select
            label="역할"
            variant="field"
            options={DEX_ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            className="w-28 shrink-0"
          />
        </div>

        {isPending ? (
          <Loading label="도감을 불러오는 중" />
        ) : isError ? (
          <EmptyState title="도감을 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." />
        ) : entries.length === 0 ? (
          <EmptyState
            title="아직 모을 수 있는 카드가 없어요"
            description="이벤트 카드팩이 열리면 여기에 도감이 생깁니다."
          />
        ) : (
          <>
            {/* 얼마나 모았는지가 이 화면의 첫 문장입니다 */}
            <p className="text-muted mb-3 text-sm">
              <span className="text-ink font-bold tabular-nums">{progress.owned}</span>
              <span className="tabular-nums"> / {progress.total}</span> 장 모았어요
            </p>

            <ul className="grid grid-cols-3 gap-3 lg:grid-cols-5 lg:gap-4">
              {/* 카드팩이 맨 앞 — 목록 밖에 배너처럼 두면 광고로 읽힙니다.
                  🔴 열 수 있는 팩과 잠긴 팩을 **따로** 그립니다. 한 칸으로 합치면
                  "1개는 열 수 있고 2개는 기다린다" 가 "1개뿐" 으로 보입니다.
                  ⚠️ 검색·필터 중에는 감춥니다 — 거른 결과에 팩이 끼면 검색 결과로 읽힙니다. */}
              {!searching && draw && draw.remaining > 0 && (
                <li>
                  <PocaPackTile count={draw.remaining} onClick={() => navigate(ROUTES.NFT_DRAW)} />
                </li>
              )}
              {!searching && draw && draw.scheduled > 0 && (
                <li>
                  <PocaPackTile
                    count={draw.scheduled}
                    openAt={draw.nextOpenAt}
                    onClick={() => navigate(ROUTES.NFT_DRAW)}
                  />
                </li>
              )}

              {visible.map((entry) => (
                <li key={entry.designId}>
                  <PocaDexCard
                    entry={entry}
                    onOpen={(photocardId) => navigate(ROUTES.NFT_DETAIL(String(photocardId)))}
                  />
                </li>
              ))}
            </ul>

            {visible.length === 0 && (
              <EmptyState
                icon={Search}
                title="찾는 카드가 없어요"
                description="다른 이름이나 역할로 찾아보세요."
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
