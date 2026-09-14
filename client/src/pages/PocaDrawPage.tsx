import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button, IconButton, Spinner } from '@/shared/components/ui';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import {
  PocaDust,
  PocaPack,
  PocaResultLine,
  PocaReveal,
  useDrawAvailability,
  usePocaDraw,
  REVEAL_BUTTON_GAP,
  REVEAL_CARD_H,
  REVEAL_TEXT_GAP,
} from '@/features/nft';

/**
 * 포토카드 뽑기.
 *
 * 페이지는 조립만 합니다 — 훅을 부르고, 단계에 따라 컴포넌트를 놓습니다.
 * 자르는 좌표 계산도, 뽑기 요청도 여기 없습니다. (CLAUDE.md 3-6)
 */
export function PocaDrawPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { phase, card, isWaiting, rising, startCut, finishCut, reset, usedUp } = usePocaDraw();

  const opened = phase === 'opening' || phase === 'revealed';
  const revealed = phase === 'revealed' && card !== null;

  /* 팩이 남아 있을 때만 다시 뽑을 수 있습니다. 뽑고 나면 캐시가 갱신돼
     남은 수가 0 이 되는 순간 버튼이 사라집니다. */
  const { data: packs } = useDrawAvailability();

  /* 서버가 "없다" 고 확실히 답했을 때만 잠급니다 — 응답 전(undefined)에는 막지 않습니다 */
  const locked = packs?.available === false && !opened;

  /* 열 팩이 없으면 **뜯기 전에** 알려 줍니다. 다 뜯고 나서 거절당하면 허탈합니다.
     ref 로 한 번만 — 뒤에서 목록 캐시가 갱신될 때마다 다시 뜨면 안 됩니다. */
  const told = useRef(false);
  useEffect(() => {
    if (!locked || told.current) return;
    told.current = true;

    open('common/confirm', {
      title: '지금은 열 수 있는 카드팩이 없어요',
      message: '이벤트 카드팩은 이미 받으셨어요. 새 카드팩이 생기면 여기서 열 수 있습니다.',
      confirmText: '내 포카 보기',
      cancelText: '닫기',
      onConfirm: () => navigate(ROUTES.MY_NFTS, { replace: true }),
    });
  }, [locked, open, navigate]);

  return (
    <div className="bg-poca-stage relative flex min-h-dvh flex-col">
      {/*
        무대 — 화면 **맨 위부터** 씁니다.
        🔴 헤더와 안내를 흐름에 두면 그만큼(72px) 무대가 줄고, 무대는 flex-1 이라
           카드가 솟구칠 때 위가 잘립니다. 둘 다 무대 위에 **떠 있게** 둡니다.
      */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden [perspective:1200px]"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 46%, rgba(46,40,28,.5), transparent 72%),' +
            'radial-gradient(ellipse at center, rgba(16,15,13,.3), rgba(6,6,6,.9) 78%)',
        }}
      >
        {/* 뒤로가기만 — 제목은 봉지가 스스로 말합니다 */}
        <div className="pt-safe absolute top-0 left-0 z-30 p-1">
          <IconButton
            label="뒤로"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/12 active:bg-white/20"
          >
            <ChevronLeft size={24} />
          </IconButton>
        </div>

        {/* 안내 — 봉지 바로 위에 떠 있습니다. 자리를 차지하지 않습니다.
            (흐름에 두면 그만큼 무대가 줄어 봉지와 카드가 위로 딸려 올라갑니다)
            봉지는 화면 중앙에 서고 높이가 491px 이므로 윗변이 50% - 246px,
            그 20px 위가 안내 자리입니다. max() 는 낮은 화면에서 잘리지 않게 잡아 줍니다. */}
        <p
          className="text-poca-hint absolute right-0 left-0 z-20 px-14 text-center text-sm"
          style={{ top: 'max(calc(50% - 286px), 12px)' }}
        >
          {/* 뽑기는 계정당 한 번뿐입니다 — 이미 썼으면 뜯으라고 안내하면 안 됩니다 */}
          {!opened &&
            (usedUp ??
              (locked
                ? '지금은 열 수 있는 카드팩이 없어요'
                : '봉지 윗부분 점선을 밀어서 뜯으세요'))}
        </p>

        {/* 카드는 **처음부터 봉지 안에** 있습니다 (z:2 — 봉지가 z:3).
            뜯을 때 마운트하면 없던 것이 튀어나온 것처럼 갑작스럽습니다. */}
        {/* 🔴 봉지가 벗겨지는 것(opened)과 카드가 올라오는 것(rising)은 시점이 다릅니다 —
            카드는 응답이 도착해야 시작합니다. 같이 묶으면 아직 뒷면인 채로 회전이 끝납니다 */}
        <PocaReveal opening={rising} revealed={revealed} card={card} />
        {/* 봉지도 뜯은 뒤에 남겨 둡니다 — 바로 지우면 갈라져 사라지는 연출이 안 보입니다 */}
        <PocaPack opened={opened} locked={locked} onCutStart={startCut} onCutThrough={finishCut} />

        {/* 꽝 먼지는 **화면 전체**에 퍼집니다 — 그래서 카드 안이 아니라 무대 바로 밑에 둡니다.
            카드가 밖으로 나오면 z:9 까지 올라가므로(poca-raise) 먼지는 z:10 입니다. */}
        <PocaDust opening={opened} card={card} />
      </div>

      {/* 결과 한 줄은 **카드 위**, 버튼은 카드 한참 아래.
          🔴 **흐름에 두지 않습니다.** 흐름에 두면 그 높이만큼 무대(flex-1)가 짧아져
          봉지와 카드가 화면 중앙보다 위로 올라가고, 버튼이 생겼다 사라질 때마다
          카드가 딸려 움직입니다. 그래서 둘 다 무대 위에 띄우고 자리를 직접 잡습니다.
          카드는 중앙에 서므로 윗변이 50% - 165px, 그 위 넉넉한 자리에 문구를 둡니다.
          max()·min() 은 낮은 화면에서 둘이 화면 밖으로 밀려나지 않게 잡아 줍니다. */}
      <p
        className="absolute inset-x-0 min-h-20 px-4 text-center text-xl font-bold text-white"
        style={{
          top: `max(calc(50% - ${REVEAL_CARD_H} / 2 - ${REVEAL_TEXT_GAP}px), 12px)`,
        }}
      >
        {/* 응답이 늦을 때만 돌아가는 표시. 다 나오면 그 자리에 결과가 들어옵니다.
            소속(서울 N반)은 굳이 보여 주지 않습니다 — 호칭에 이미 담겨 있습니다. */}
        {isWaiting && <Spinner />}
        {revealed && card && <PocaResultLine card={card} />}
      </p>

      <div
        className={cn(
          'absolute inset-x-0 flex gap-2 px-4 transition-opacity duration-300',
          /* 카드 → 문구 → 버튼 **순서대로** 나옵니다.
             지연 0.7s = 문구가 다 뜨는 시각(0.4 + 0.42) 직후.
             invisible 이라 그 전에는 탭 순서에도 없습니다. */
          revealed ? 'visible opacity-100 delay-700' : 'invisible opacity-0',
        )}
        style={{
          top: `min(calc(50% + ${REVEAL_CARD_H} / 2 + ${REVEAL_BUTTON_GAP}px), calc(100% - 100px))`,
        }}
      >
        {/* 팩이 남았을 때만 — 없는데 버튼을 두면 눌러도 반드시 실패합니다 */}
        {packs?.available && (
          <Button variant="secondary" fullWidth onClick={reset}>
            다시 뽑기
          </Button>
        )}{' '}
        {/* 🔴 replace — 뽑기 화면을 **방문 기록에서 지우고** 갑니다.
            그냥 밀어 넣으면 내 포카에서 뒤로 갈 때 다 쓴 뽑기 화면으로 되돌아옵니다. */}
        <Button fullWidth onClick={() => navigate(ROUTES.MY_NFTS, { replace: true })}>
          내 포카 보기
        </Button>
      </div>
    </div>
  );
}
