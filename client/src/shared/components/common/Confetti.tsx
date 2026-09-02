import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/shared/hooks';

interface Props {
  /** 터뜨릴 조각 수 */
  count?: number;
  /** 몇 초간 남아 있을지 */
  seconds?: number;
}

/**
 * 한 번 터지고 사라지는 폭죽(색종이).
 *
 * ── 왜 canvas 인가 ─────────────────────────────────────────
 * 조각 하나당 DOM 노드를 만들면 100개가 넘어가는 순간 프레임이 무너집니다.
 * canvas 한 장에 그리면 노드는 하나뿐입니다.
 *
 * ── 왜 무채색인가 ──────────────────────────────────────────
 * 이 앱은 무채색 시스템입니다(DESIGN.md 1장). 폭죽만 알록달록하면
 * 그 화면만 다른 앱처럼 보입니다. 대신 **명도와 크기**를 흩어 놓아
 * 종이 조각이 뒤집히며 떨어지는 느낌을 만듭니다.
 *
 * ── 지켜야 할 선 ───────────────────────────────────────────
 * 예매 완료처럼 **한 흐름이 끝나는 지점에서 한 번만** 씁니다.
 * 반복되면 축하가 아니라 소음입니다. 다 떨어지면 스스로 정리합니다.
 */
const INK = ['#111111', '#333333', '#5a5a5a', '#8a8a8a', '#b5b5b5'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  spin: number;
  color: string;
}

export function Confetti({ count = 90, seconds = 2.6 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    // "동작 줄이기" 를 켠 사용자에게 화면 가득 날아다니는 조각은 폭력적입니다.
    if (reduced) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    /* 화면 위쪽 양옆에서 안쪽으로 쏘아 올립니다.
       가운데 한 점에서 터지면 "로딩 스피너" 처럼 보입니다. */
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -1 : 1) * (0.6 + Math.random() * 0.5);
      const speed = 7 + Math.random() * 7;
      return {
        x: fromLeft ? width * 0.12 : width * 0.88,
        y: height * 0.34 + Math.random() * 24,
        vx: Math.sin(angle) * speed,
        vy: -Math.abs(Math.cos(angle)) * speed * 0.85,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: INK[Math.floor(Math.random() * INK.length)] ?? INK[0]!,
      };
    });

    const GRAVITY = 0.28;
    const DRAG = 0.992;
    let raf = 0;
    const startedAt = performance.now();

    const draw = (time: number) => {
      const elapsed = (time - startedAt) / 1000;
      // 마지막 0.6초 동안 서서히 사라져 뚝 끊기지 않게
      const fade = Math.max(0, Math.min(1, (seconds - elapsed) / 0.6));

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = fade;

      for (const p of pieces) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        // 회전에 따라 폭이 줄어들어 종이가 뒤집히는 것처럼 보입니다.
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(Math.cos(p.rotation)), p.h);
        ctx.restore();
      }

      if (elapsed < seconds) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [count, seconds, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  );
}
