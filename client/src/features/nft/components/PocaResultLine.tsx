import { cn } from '@/shared/lib';
import { PocaJumpText } from './PocaJumpText';
import { drawLine, drawMessage, isSpecial } from '../model/pocaDraw.model';
import type { PocaDrawResult } from '../model/nft.types';

/**
 * 첫 파도를 미루는 시간.
 *
 * 🔴 `--animate-poca-line-in` 의 **지연(0.4s) + 길이(0.42s)** 와 같아야 합니다.
 * 짧으면 아직 떠오르는 중에 글자가 뛰어 어수선하고, 길면 한참 멈춰 있다 뜁니다.
 * (저 값을 바꾸면 여기도 함께 바꾸세요)
 */
const LINE_IN_S = 0.82;

interface Props {
  card: PocaDrawResult;
  className?: string;
}

/**
 * 결과 문구 — 가운데 큰 글씨만 글자 단위로 움직입니다.
 *
 * ```
 *   으악...            작고 흐리게        (개발자 카드에만)
 *   최재성 개발자        크게 · 글자마다 움직임
 *   카드네요...         작고 흐리게
 * ```
 *
 * 등급에 따라 움직임이 다릅니다 — **좋은 카드는 통통 뛰고, 꽝은 부르르 떱니다.**
 * 어디서 끊을지는 화면이 정하지 않습니다(`drawLine`).
 *
 * 🔴 **줄 등장(opacity)과 글자 움직임(transform)은 다른 요소에 겁니다.**
 * 한 요소에 둘 다 걸면 나중 것이 앞엣것의 transform 을 덮어씁니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaResultLine({ card, className }: Props) {
  const { prefix, lead, josa, tail } = drawLine(card);
  const special = isSpecial(card.grade);

  return (
    <span
      className={cn(
        'motion-safe:animate-poca-line-in inline-block',
        /* 감탄사가 붙는 개발자 카드는 한 줄이 더 많습니다.
           그만큼만 살짝 끌어올려 카드와의 간격을 다른 등급과 맞춥니다.
           🔴 transform 이 아니라 margin 입니다 — 등장 애니메이션이 transform 을 쓰고 있어서,
           여기에 translate 를 겹치면 애니메이션이 끝나는 순간 글씨가 툭 튑니다. */
        prefix && '-mt-2',
        className,
      )}
    >
      {/* 🔴 읽어 주는 기기에는 **온전한 한 문장**으로 들려줍니다.
          쪼갠 글자를 그대로 읽으면 한 자씩 끊어 읽습니다. */}
      <span className="sr-only">{drawMessage(card)}</span>

      <span aria-hidden>
        {/* 감탄사 — 큰 글씨 위에 작게 */}
        {prefix && <span className="block text-[0.72em] text-white/55">{prefix}</span>}

        <PocaJumpText
          text={lead}
          glow={special}
          delayS={LINE_IN_S}
          className={cn('text-[1.55em]', !special && 'text-poca-violet')}
        />

        {/* 조사는 큰 글씨 끝에 작게 — 이름에 눈이 먼저 가게 합니다 */}
        {josa && <span className="text-[0.72em] text-white/55">{josa}</span>}

        {/* 아랫줄 — 조사와 같은 크기로 */}
        <span className="block text-[0.72em] text-white/55">{tail}</span>
      </span>
    </span>
  );
}
