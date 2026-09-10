import { cn } from '@/shared/lib';
import cardBackUrl from '@/assets/poca/card-back.webp';
import haloUrl from '@/assets/poca/halo.webp';
import haloDarkUrl from '@/assets/poca/halo-dark.webp';
import { PocaArt } from './PocaArt';
import { PocaFace } from './PocaFace';
import { PocaMotes } from './PocaMotes';
import { isSpecial } from '../model/pocaDraw.model';
import { pocaSeed } from '../model/nft.model';
import type { PocaDrawResult } from '../model/nft.types';

const CARD_W = 220;
const CARD_H = 330;

interface Props {
  /** 봉지가 갈라지기 시작했는가 — 카드가 올라옵니다 */
  opening: boolean;
  /** 착지까지 끝났는가 — 이때부터 이따금 한 바퀴 돕니다 */
  revealed: boolean;
  /** 뽑힌 카드. 아직 응답 전이면 null (뒷면만 보입니다) */
  card: PocaDrawResult | null;
  className?: string;
}

/**
 * 뽑힌 카드가 올라와 뒤집히는 연출.
 *
 * 세 겹으로 나눠 놓았습니다 — **한 요소에 transform 애니메이션을 두 개 걸면
 * 뒤엣것이 앞엣것을 덮어씁니다.**
 *
 *   lift   상승·낙하   translateY
 *   bob    부유        translateY   ← perspective 도 여기 (직계 자식에만 적용되므로)
 *   flip   회전        rotateY
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다.
 */
export function PocaReveal({ opening, revealed, card, className }: Props) {
  const special = card ? isSpecial(card.grade) : true;

  return (
    <div
      className={cn(
        /* 착지 애니메이션(poca-lift)이 **+18px 에서 끝나므로**, 기준점을 그만큼
           위에 둬야 멈춰 선 카드가 정확히 무대 한가운데 — 봉지가 있던 자리 — 에 옵니다.
           기준점을 50% 로 두면 카드가 중앙보다 18px 아래에 서서 어긋나 보입니다. */
        'pointer-events-none absolute top-[calc(50%-18px)] left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2',
        /* 봉지(z:3)보다 뒤 = **봉지 안**. 밖으로 빠져나온 뒤에야 앞으로 나옵니다.
           처음부터 앞에 두면 아직 봉지 안인데 겉으로 겹쳐 보이고,
           뜯는 순간 카드가 튀어나온 것처럼 갑작스러워집니다. */
        opening && 'motion-safe:animate-poca-raise motion-reduce:z-9',
        className,
      )}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <div className={cn('size-full', opening && 'motion-safe:animate-poca-lift')}>
        {/* 후광 — 카드와 함께 떠오르되, 부유(bob)에는 따라가지 않습니다.
            빛까지 같이 흔들리면 광원이 흔들리는 것처럼 보입니다. */}
        <div
          aria-hidden
          className={cn(
            'absolute top-1/2 left-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2 opacity-0',
            opening && 'motion-safe:animate-poca-halo',
          )}
        >
          <div
            className={cn(
              'size-full bg-cover bg-center blur-[2.5px]',
              opening && 'motion-safe:animate-poca-rays',
              !special && 'brightness-90 saturate-90',
            )}
            style={{
              backgroundImage: `url(${special ? haloUrl : haloDarkUrl})`,
              maskImage: 'radial-gradient(circle closest-side, #000 62%, transparent 97%)',
              WebkitMaskImage: 'radial-gradient(circle closest-side, #000 62%, transparent 97%)',
            }}
          />
        </div>

        {/* 빛 알갱이 */}
        {opening && <PocaMotes count={54} glow={special} />}

        {/* 부유 — perspective 가 여기 있어야 아래 flip 이 평면으로 안 보입니다 */}
        <div
          className={cn(
            'relative size-full [perspective:1200px]',
            opening && 'motion-safe:animate-poca-bob',
          )}
        >
          {/* 🔴 회전이 **두 겹**입니다. 한 요소에 둘 다 걸면 나중 것이 앞엣것을
              덮어써서, 등장 회전이 채 끝나기 전에 잘려 나갑니다.
                바깥 = 착지 후 이따금 한 바퀴 (0 → 360)
                안쪽 = 등장 회전 (0 → 900, forwards 로 앞면 유지) */}
          <div
            className={cn(
              'size-full [transform-style:preserve-3d]',
              revealed && 'motion-safe:animate-poca-idle-spin',
            )}
          >
            <div
              className={cn(
                'relative size-full [transform-style:preserve-3d]',
                opening && card && 'motion-safe:animate-poca-spin',
              )}
            >
              {/* 뒷면 */}
              <PocaFace glow={special}>
                <img
                  src={cardBackUrl}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              </PocaFace>

              {/* 앞면 — 180° 돌려 두면 회전이 끝났을 때 정면입니다 */}
              <PocaFace glow={special} flipped>
                {card ? (
                  <PocaArt
                    seed={pocaSeed(card.photocardId)}
                    imageUrl={card.imageUrl}
                    alt={`${card.designName} 포토카드`}
                    className="size-full rounded-none"
                  />
                ) : null}

                {/* 광택 — 앞면을 비스듬히 쓸고 지나갑니다. 꽝에는 없습니다.
                    부모가 overflow-hidden 이라 카드 밖으로 새지 않습니다. */}
                {special && (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
