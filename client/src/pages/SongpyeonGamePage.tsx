import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import {
  failMessage,
  SongpyeonBoard,
  SongpyeonClearModal,
  SongpyeonHud,
  SongpyeonIntro,
  useSongpyeonChallenge,
} from '@/features/token';

/**
 * 캣머니 게임 — 송편 잡기(추석 이벤트).
 *
 * 🔴 머리말만 남기고 **화면 전체를 판이 씁니다.** 높이를 `h-dvh` 로 못 박고
 * `overflow-hidden` 을 걸어 스크롤이 생기지 않게 합니다 — 판이 스크롤되면 조각이
 * 화면 밖에서 떴다 사라집니다. (`TokenGamePage` 와 같은 뼈대)
 *
 * 5단계를 통과하면 **하루 한 번** 캣머니를 받습니다. 금액도, 오늘 받았는지도 서버가
 * 정합니다 — 이 페이지는 `useSongpyeonChallenge` 가 내주는 것을 배치만 합니다.
 */
export function SongpyeonGamePage() {
  const { game, alreadyClaimed, reward, loading, claiming, claimFailed, retryClaim, start } =
    useSongpyeonChallenge();

  const playing = game.status === 'playing';
  const failed = game.status === 'failed';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header title="송편 잡기" showBack />

      {/* 짙은 면은 `surface-strong` 하나입니다 — 화면 코드에 색을 적지 마세요.
          안쪽 글자는 이 면이 내려주는 색을 물려받고 투명도로만 층을 만듭니다. (CLAUDE.md 4-6) */}
      <div className="surface-strong flex min-h-0 flex-1 flex-col px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {game.status === 'idle' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <SongpyeonIntro
              onStart={start}
              loading={loading}
              alreadyClaimed={alreadyClaimed}
              reward={reward}
            />
          </div>
        ) : (
          <>
            <SongpyeonHud stageStartedAt={game.stageStartedAt} stage={game.stage} />

            <div className="min-h-0 flex-1 py-1">
              {/* 🔴 끝난 뒤에도 판을 남깁니다. 방금 무엇을 눌렀는지 보여야 다음 판이 달라집니다 */}
              <SongpyeonBoard pieces={game.pieces} locked={!playing} onCatch={game.catchPiece} />
            </div>

            <div className="shrink-0 space-y-2 pt-2">
              {failed && game.failReason && (
                <p className="text-center text-sm font-bold">
                  {failMessage(game.failReason)}
                  <span className="block text-xs font-normal opacity-65">
                    1단계부터 다시 도전해요.
                  </span>
                </p>
              )}

              {playing ? (
                <p className="text-center text-xs opacity-60">송편만 잡으세요</p>
              ) : alreadyClaimed ? (
                /* 오늘 몫이 끝났으면 "다시 하기" 를 두지 않습니다 — 이겨도 받을 게 없는 판입니다 */
                <p className="text-center text-sm font-bold">
                  오늘 게임을 이미 성공했어요
                  <span className="block text-xs font-normal opacity-70">내일 또 도전해주세요</span>
                </p>
              ) : (
                <Button variant="secondary" size="md" fullWidth onClick={start}>
                  다시 하기
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <SongpyeonClearModal
        open={game.resultOpen}
        reward={reward}
        claiming={claiming}
        failed={claimFailed}
        onRetry={retryClaim}
        onClose={game.dismissResult}
      />
    </div>
  );
}
