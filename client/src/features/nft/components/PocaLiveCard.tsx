import { cn } from '@/shared/lib';
import cardBackUrl from '@/assets/poca/card-back.webp';
import { PocaArt } from './PocaArt';
import { PocaFace } from './PocaFace';
import { PocaMotes } from './PocaMotes';
import { pocaSeed } from '../model/nft.model';

interface Props {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  /** 좋은 카드인가 — 테두리·둘레 빛 색과 광택 유무를 정합니다 */
  glow: boolean;
  /** 둘레에 빛 알갱이를 뿌릴지 */
  motes?: boolean;
  /** 상자 크기는 바깥이 정합니다. 2:3 은 여기서 지킵니다 */
  className?: string;
}

/**
 * **살아 있는 카드** — 가만히 떠 있다가 이따금 휘리릭 돌고, 표면을 광택이 쓸고 지나갑니다.
 *
 * 뽑기 연출과 같은 움직임이되 **지연이 없습니다**(`poca-hover` · `poca-turn` · `poca-sheen`).
 * 크게 보기(`PocaSpotlight`)와 상세 화면이 같이 씁니다 — 두 곳에서 다르게 움직이면
 * 같은 카드인데 다른 물건처럼 보입니다.
 *
 * 🔴 부유(translateY) · 회전(rotateY) · 광택은 **서로 다른 요소**에 겁니다.
 * 한 요소에 둘을 걸면 나중 것이 앞엣것의 transform 을 덮어씁니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaLiveCard({
  photocardId,
  designName,
  imageUrl,
  glow,
  motes = false,
  className,
}: Props) {
  return (
    /* 🔴 뽑기용 토큰(poca-bob · poca-idle-spin)은 봉지가 갈라지기를 기다리느라
       2초 넘게 멈춰 있습니다. 여기서는 들어오자마자 움직여야 해서 지연 없는 짝을 씁니다. */
    <div className={cn('motion-safe:animate-poca-hover relative [perspective:1200px]', className)}>
      {motes && <PocaMotes count={26} glow={glow} />}

      <div className="motion-safe:animate-poca-turn size-full [transform-style:preserve-3d]">
        <PocaFace glow={glow}>
          <PocaArt
            seed={pocaSeed(photocardId)}
            imageUrl={imageUrl}
            alt={`${designName} 포토카드`}
            className="size-full rounded-none"
          />

          {/* 광택 — 앞면을 비스듬히 쓸고 지나갑니다. 꽝에는 없습니다(탁해 보여야 합니다).
              부모가 overflow-hidden 이라 카드 밖으로 새지 않습니다. */}
          {glow && (
            <span
              aria-hidden
              className="motion-safe:animate-poca-sheen pointer-events-none absolute top-[-60%] left-0 h-[220%] w-3/5 opacity-0"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,247,210,.7), transparent)',
              }}
            />
          )}
        </PocaFace>

        <PocaFace glow={glow} flipped>
          <img src={cardBackUrl} alt="" draggable={false} className="size-full object-cover" />
        </PocaFace>
      </div>
    </div>
  );
}
