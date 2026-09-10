import { cn } from '@/shared/lib';
import { Lightbox } from '@/shared/components/ui';
import haloUrl from '@/assets/poca/halo.webp';
import haloDarkUrl from '@/assets/poca/halo-dark.webp';
import { PocaLiveCard } from './PocaLiveCard';
import { PocaJumpText } from './PocaJumpText';
import { PocaMotes } from './PocaMotes';
import { isSpecial, pocaTitle } from '../model/pocaDraw.model';
import type { PocaGrade } from '../model/nft.types';

/** 뽑기 화면과 같은 크기 (2:3) — 더 키우면 "크게 보기" 가 아니라 화면을 덮습니다 */
const CARD_W = 220;
const CARD_H = 330;

/**
 * 글자 파도를 미루는 시간.
 *
 * 🔴 오버레이가 페이드로 나타나는 동안 파도가 지나가 버리면, 눈에는 **뒷글자부터**
 * 움직이는 것처럼 보입니다("코치님 김권수"). 다 뜬 뒤에 첫 글자부터 시작해야 합니다.
 */
const FADE_IN_S = 0.5;

interface Props {
  open: boolean;
  onClose: () => void;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  /** 소속 — '서울 5반' · '15기' · '개발자'. 서버가 아직 안 주면 이름만 뜹니다 */
  group?: string;
  grade?: PocaGrade;
}

/**
 * 가진 카드를 **뽑았을 때처럼** 보여 줍니다.
 *
 * 뽑기 화면(`PocaReveal`)의 주변 연출을 그대로 씁니다 — 후광, 빛 알갱이, 광택,
 * 부유, 이따금 한 바퀴. **봉지에서 솟구쳐 나오는 등장 연출만** 뺐습니다.
 * 여기는 이미 가진 카드를 보는 자리라, 없던 것이 나타나는 것이 아닙니다.
 *
 * 검은 화면·닫기·ESC 는 공용 `Lightbox` 가 맡습니다.
 *
 * 등급에 따라 갈립니다 — 좋은 카드는 금색 후광에 광택이 지나가고 글자가 통통 뛰지만,
 * 개발자 카드는 **어두운 후광 · 보라색 · 광택 없음** 에 글자가 부르르 떱니다.
 *
 * 🔴 등급(`grade`)·소속(`group`)은 **선택**입니다. 실서버 포카 응답에는 아직 없고
 * 목업만 채웁니다. 없으면 이름만 · 금색으로 물러섭니다 — 추측해서 코치를
 * 교육생이라 부르는 일은 만들지 않습니다. (CLAUDE.md 8장)
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaSpotlight({
  open,
  onClose,
  photocardId,
  designName,
  imageUrl,
  group,
  grade,
}: Props) {
  /* 등급을 모르면 좋은 카드로 봅니다 — 가진 카드를 꽝처럼 어둡게 보여줄 이유가 없습니다 */
  const special = grade === undefined || isSpecial(grade);

  return (
    <Lightbox open={open} onClose={onClose} label={`${designName} 포토카드 크게 보기`}>
      {/* 🔴 Lightbox 는 자식을 `w-full max-w-…` 블록으로 감쌉니다.
          그 안에서 **가운데를 직접 잡아야** 합니다 — 안 그러면 왼쪽 끝에 붙습니다.
          mb — 아래 닫기 버튼과 조금 더 떨어뜨립니다. */}
      <div className="mb-6 flex flex-col items-center gap-10">
        {/* 이름 — 뽑기 결과와 같은 글씨, 같은 파도.
            🔴 z-10 이 필요합니다. 후광은 카드보다 크게 퍼져 **카드 위쪽으로 넘쳐 나오는데**,
            카드 상자가 이름보다 나중에 그려져서 그냥 두면 빛이 글씨를 덮어 안 읽힙니다. */}
        <PocaJumpText
          text={pocaTitle(designName, group, grade)}
          glow={special}
          delayS={FADE_IN_S}
          className={cn('relative z-10 text-4xl', special ? 'text-white' : 'text-poca-violet')}
        />

        {/* isolate — 쌓임 맥락을 여기서 끊어야 뒤(-z-10)의 후광이
            Lightbox 의 검은 배경 뒤로 숨지 않습니다. */}
        <div className="relative isolate" style={{ width: CARD_W, height: CARD_H }}>
          {/* 후광 — 카드 뒤에서 천천히 돕니다.
              가장자리를 mask 로 흐려 없애지 않으면 원본의 직선 경계가 그대로 보입니다. */}
          {/* 🔴 pointer-events-none — 후광은 600px 라 카드 아래 닫기 버튼까지 덮습니다.
              자리 잡힌(positioned) 요소라 칠하기 순서상 static 인 버튼보다 위에 놓여,
              이게 없으면 **닫기 버튼이 눌리지 않습니다.** */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={cn(
                'motion-safe:animate-poca-rays size-full bg-cover bg-center blur-[2.5px]',
                !special && 'brightness-90 saturate-90',
              )}
              style={{
                backgroundImage: `url(${special ? haloUrl : haloDarkUrl})`,
                maskImage: 'radial-gradient(circle closest-side, #000 62%, transparent 97%)',
                WebkitMaskImage: 'radial-gradient(circle closest-side, #000 62%, transparent 97%)',
              }}
            />
          </div>

          <PocaMotes count={54} glow={special} />

          <PocaLiveCard
            photocardId={photocardId}
            designName={designName}
            imageUrl={imageUrl}
            glow={special}
            className="relative size-full"
          />
        </div>
      </div>
    </Lightbox>
  );
}
