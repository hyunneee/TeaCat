import { Flag } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { usePhotocardArts } from '@/features/nft';
import {
  MemoryBoard,
  MemoryClearModal,
  MemoryHud,
  MemoryIntro,
  useMemoryArt,
  useMemoryGame,
} from '@/features/token';

/**
 * 캣머니 게임 — 포토카드 짝 맞추기(4×4).
 *
 * 🔴 머리말만 남기고 **화면 전체를 판이 씁니다.** 높이를 `h-dvh` 로 못 박고
 * `overflow-hidden` 을 걸어 스크롤이 생기지 않게 합니다. 판이 화면에 들어가는 건
 * `MemoryBoard` 의 `BOARD_MAX_WIDTH` 가 맡습니다 — 거기 주석을 보세요.
 *
 * 🔴 게임은 **아직 캣머니를 주지 않습니다** — 클리어 등급만 보여주는 임시 기능입니다
 * (`features/token` 의 `REWARD_TIERS` 주석). 지급을 붙일 때는 시간을 재는 것도
 * 금액을 정하는 것도 서버여야 합니다.
 *
 * ⚠️ 판에 쓸 그림 후보를 **페이지가 받아서 넘깁니다.** `features/token` 이
 * `features/nft` 를 직접 부르면 `features/nft` → `features/token`(tokenKeys) 와
 * 순환 참조가 됩니다. 페이지는 두 feature 를 다 알아도 되는 자리입니다.
 */
export function TokenGamePage() {
  /* 🔴 **등록된 카드 그림 전체**를 씁니다 (소유물이 아니라 도안입니다).
     내 카드나 마켓 목록을 쓰면 "가진 게 없으면 / 아무도 안 팔면 그림이 없는" 화면이
     됩니다 — 마켓은 판매 중인 카드만 나오므로 0장인 날이 흔합니다.
     여기서 8종을 섞어 뽑으므로 들어올 때마다 다른 그림으로 놀 수 있습니다. */
  const { data: arts, isLoading: artsLoading } = usePhotocardArts();

  const { art, loading: artLoading } = useMemoryArt(
    (arts ?? []).map((a) => ({ designName: a.name, imageUrl: a.imageUrl })),
    artsLoading,
  );

  const game = useMemoryGame(art);
  const finished = game.status === 'cleared' || game.status === 'gaveup';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header title="포토카드 짝 맞추기" showBack />

      {/* 짙은 면은 `surface-strong` 하나입니다 — 화면 코드에 색을 적지 마세요.
          안쪽 글자는 이 면이 내려주는 색을 물려받고 투명도로만 층을 만듭니다. (CLAUDE.md 4-6) */}
      <div className="surface-strong flex min-h-0 flex-1 flex-col px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {game.status === 'idle' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <MemoryIntro onStart={game.start} loading={artLoading} />
          </div>
        ) : (
          <>
            <MemoryHud startedAt={game.startedAt} frozenMs={game.elapsedMs} moves={game.moves} />

            <div className="flex min-h-0 flex-1 items-center justify-center py-1">
              {/* 🔴 판은 끝난 뒤에도 남깁니다. 마지막 한 장을 맞추자마자 판이 사라지면
                  방금 무엇을 뒤집었는지 못 보고 화면만 바뀝니다. */}
              <MemoryBoard
                deck={game.deck}
                round={game.round}
                flipped={game.flipped}
                matched={game.matched}
                missed={game.missed}
                locked={finished || game.flipped.length >= 2}
                revealAll={finished}
                onFlip={game.flip}
              />
            </div>

            <div className="shrink-0 pt-2">
              {game.status === 'playing' ? (
                /* 되돌릴 수 없는 동작 목록(CLAUDE.md 4-7)에 드는 일은 아니라 붉게 두지
                   않습니다. 대신 짙은 면 위에서 **버튼으로 보이도록** 테두리를 두릅니다 —
                   글자만 있으면 판에 묻혀 빠져나갈 길이 없는 화면이 됩니다.
                   (짙은 면 위에서 색을 직접 주는 방식은 `PocaDrawPage` 와 같습니다) */
                <Button
                  variant="ghost"
                  size="md"
                  fullWidth
                  leftIcon={<Flag size={16} />}
                  onClick={game.giveUp}
                  className="border-2 border-white/50 text-white hover:bg-white/15 hover:text-white"
                >
                  포기하기
                </Button>
              ) : (
                <Button variant="secondary" size="md" fullWidth onClick={game.start}>
                  다시 하기
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <MemoryClearModal
        open={game.resultOpen}
        elapsedMs={game.elapsedMs ?? 0}
        reward={game.reward}
        moves={game.moves}
        onRestart={game.start}
        onClose={game.dismissResult}
      />
    </div>
  );
}
