import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import {
  MemoryBoard,
  MemoryClearModal,
  MemoryHud,
  MemoryIntro,
  useMemoryGame,
} from '@/features/token';

/**
 * 캣머니 벌기 — 포토카드 짝 맞추기(4×4).
 *
 * 🔴 머리말만 남기고 **화면 전체를 판이 씁니다.** 높이를 `h-dvh` 로 못 박고
 * `overflow-hidden` 을 걸어 스크롤이 생기지 않게 합니다. 판이 화면에 들어가는 건
 * `MemoryBoard` 의 `BOARD_MAX_WIDTH` 가 맡습니다 — 거기 주석을 보세요.
 *
 * 🔴 게임은 **아직 캣머니를 주지 않습니다** — 클리어 등급만 보여주는 임시 기능입니다
 * (`features/token` 의 `REWARD_TIERS` 주석). 지급을 붙일 때는 시간을 재는 것도
 * 금액을 정하는 것도 서버여야 합니다.
 */
export function TokenPage() {
  const game = useMemoryGame();
  const finished = game.status === 'cleared' || game.status === 'gaveup';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header title="캣머니 벌기" showBack />

      {/* 짙은 면은 `surface-strong` 하나입니다 — 화면 코드에 색을 적지 마세요.
          안쪽 글자는 이 면이 내려주는 색을 물려받고 투명도로만 층을 만듭니다. (CLAUDE.md 4-6) */}
      <div className="surface-strong flex min-h-0 flex-1 flex-col px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {game.status === 'idle' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <MemoryIntro onStart={game.start} />
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
                   않습니다. 대신 판에서 눈을 끌지 않도록 조용하게 둡니다. */
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={game.giveUp}
                  className="text-white/70 hover:bg-white/10 hover:text-white"
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
