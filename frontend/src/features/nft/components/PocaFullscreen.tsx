import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { Lightbox } from '@/shared/components/ui';
import { useReducedMotion } from '@/shared/hooks';
import { useGlareSweep } from '../hooks/useGlareSweep';
import { PocaArt } from './PocaArt';
import { PocaGlare } from './PocaGlare';

interface Props {
  open: boolean;
  onClose: () => void;
  seed: string;
  imageUrl?: string | null;
  name: string;
  concertTitle: string;
}

/** 몇 초마다 표면에 빛이 한 번 지나갈지 */
const SHINE_INTERVAL_MS = 5000;
/** 끝까지 끌었을 때의 기울기(도). 이보다 크면 카드가 아니라 문짝처럼 보입니다. */
const MAX_TILT = 16;
/** 이 거리(px)를 끌면 최대 기울기 */
const TILT_RANGE = 130;
/** 손을 떼면 제자리로 */
const SETTLE = { type: 'spring', stiffness: 320, damping: 28 } as const;

/**
 * 포토카드 전체화면 보기 — 실물 카드를 눈앞에 들어 **손으로 기울여 보는 것**.
 *
 * 검은 화면·닫기·ESC 같은 껍데기는 `Lightbox` 가 맡고, 여기는 카드와 기울기만 봅니다.
 *
 * ── 실제 휴대폰에서 기울기가 안 먹던 이유 ─────────────────
 * 1. **동작 줄이기(prefers-reduced-motion)** — 켜져 있으면 기울이기를 통째로 막고
 *    있었습니다. 안드로이드는 **절전 모드만 켜도** 이 값이 reduce 가 되고,
 *    iOS 도 손쉬운 사용에서 흔히 켭니다. PC 는 대개 꺼져 있어 재현되지 않습니다.
 *    → 손가락을 그대로 따라가는 **직접 조작**은 "덜어낼 애니메이션" 이 아니라
 *      조작 그 자체입니다. 이제 동작 줄이기에서도 기울어지고,
 *      **손을 뗐을 때 튕겨 돌아오는 연출과 빛 반사만** 생략합니다.
 * 2. **손가락이 카드 밖으로 나가면** 포인터 캡처가 실패한 브라우저에서
 *    이동이 뚝 끊겼습니다. → 끄는 동안은 `window` 에서 직접 듣습니다.
 * 3. **길게 누르면** 브라우저가 이미지 저장/드래그를 가로챘습니다(pointercancel).
 *    → 카드에 `no-select`(터치 콜아웃·선택 금지) + `touch-none` 을 겁니다.
 */
export function PocaFullscreen({ open, onClose, seed, imageUrl, name, concertTitle }: Props) {
  const reduced = useReducedMotion();

  /* 열려 있는 동안에만 반짝입니다 — 닫힌 오버레이에서 타이머가 돌 이유가 없습니다. */
  const { glare, intensity } = useGlareSweep({ repeatMs: SHINE_INTERVAL_MS, enabled: open });

  /* 끌면 **기울기만** 바뀝니다. 카드는 화면 한가운데에 그대로 있습니다.
     가로로 끌면 좌우로, 세로로 끌면 앞뒤로 — 실물 카드를 쥔 방향과 같습니다.

     ⚠️ motion 의 `drag` 를 쓰지 않는 이유: drag 는 카드를 실제로 **옮깁니다.**
        dragConstraints 를 0 으로 묶어도 elastic 만큼 딸려 나가서
        "크게 보려고 눌렀는데 카드가 도망가는" 느낌이 납니다.
        포인터 이동량을 직접 받아 회전 값에만 흘려보냅니다. */
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  // useTransform 은 범위를 벗어나면 잘라냅니다 — 아무리 끌어도 MAX_TILT 를 넘지 않습니다.
  const rotateY = useTransform(offsetX, [-TILT_RANGE, TILT_RANGE], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(offsetY, [-TILT_RANGE, TILT_RANGE], [MAX_TILT, -MAX_TILT]);

  /** 누른 지점. null 이면 지금 끌고 있지 않다는 뜻입니다. */
  const grabbedAt = useRef<{ x: number; y: number } | null>(null);

  const settle = useCallback(() => {
    if (!grabbedAt.current) return;
    grabbedAt.current = null;
    /* 동작 줄이기면 튕기지 않고 그 자리에서 눕습니다 (움직임 자체는 유지) */
    const options = reduced ? { duration: 0 } : SETTLE;
    animate(offsetX, 0, options);
    animate(offsetY, 0, options);
  }, [offsetX, offsetY, reduced]);

  /* 끄는 동안은 **window 에서** 듣습니다.
     카드에만 걸어두면 손가락이 카드 밖으로 조금만 나가도 이동이 끊깁니다
     (포인터 캡처는 브라우저마다 실패하거나 취소될 수 있어 믿고 맡기지 않습니다). */
  useEffect(() => {
    if (!open) return;

    const move = (event: PointerEvent) => {
      const from = grabbedAt.current;
      if (!from) return;
      offsetX.set(event.clientX - from.x);
      offsetY.set(event.clientY - from.y);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', settle);
    window.addEventListener('pointercancel', settle);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', settle);
      window.removeEventListener('pointercancel', settle);
      grabbedAt.current = null;
      offsetX.set(0);
      offsetY.set(0);
    };
  }, [open, settle, offsetX, offsetY]);

  const startTilt = (event: ReactPointerEvent<HTMLDivElement>) => {
    grabbedAt.current = { x: event.clientX, y: event.clientY };
  };

  return (
    <Lightbox
      open={open}
      onClose={onClose}
      label={`${name} 크게 보기`}
      caption={
        <>
          <p className="text-base font-bold text-white">{name}</p>
          <p className="text-sm text-white/60">{concertTitle}</p>
        </>
      }
    >
      <motion.div
        onPointerDown={startTilt}
        // 위치(x·y)는 건드리지 않습니다 — 카드는 늘 화면 한가운데입니다.
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        /* touch-none — 손가락 움직임을 스크롤로 가져가지 않게.
           no-select  — 길게 눌렀을 때 뜨는 이미지 저장/선택 메뉴를 막습니다.
                        (그게 뜨는 순간 pointercancel 이 와서 기울이기가 끊깁니다) */
        className="no-select relative w-full cursor-grab touch-none active:cursor-grabbing"
      >
        <PocaArt seed={seed} imageUrl={imageUrl} alt={`${name} 포토카드`} />
        <PocaGlare glare={glare} intensity={intensity} />
      </motion.div>
    </Lightbox>
  );
}
