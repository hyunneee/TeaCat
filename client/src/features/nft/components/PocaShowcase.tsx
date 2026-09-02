import { cn } from '@/shared/lib';
import { useGlareSweep } from '../hooks/useGlareSweep';
import { PocaArt } from './PocaArt';
import { PocaGlare } from './PocaGlare';

interface Props {
  seed: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  /**
   * 카드를 눌렀을 때 — 보통 전체화면 보기를 엽니다.
   * 안 넘기면 **누를 수 없는 그림**이 됩니다 (남의 카드를 살 때).
   */
  onOpen?: () => void;
}

/**
 * 상세 화면의 포토카드 한 장 — **빛 반사** 연출.
 *
 * 새 카드 표면에 사선(`/`)으로 빛이 한 번 스쳐 지나갑니다. **들어왔을 때 한 번만.**
 * 누르는 동작은 반짝임이 아니라 **전체화면 보기**에 씁니다 —
 * 카드를 누르는 사람은 다시 반짝이길 원하는 게 아니라 크게 보고 싶은 겁니다.
 *
 * 연출 규칙은 `useGlareSweep`, 그리기는 `PocaGlare` 에 있습니다.
 */
export function PocaShowcase({ seed, imageUrl, alt, className, onOpen }: Props) {
  const { glare, intensity } = useGlareSweep();

  const art = (
    <>
      <PocaArt seed={seed} imageUrl={imageUrl} alt={alt} />
      <PocaGlare glare={glare} intensity={intensity} />
    </>
  );

  /* 열 수 없으면 버튼으로 만들지 않습니다.
     눌러도 아무 일 없는 버튼은 "고장난 화면" 으로 읽힙니다. */
  if (!onOpen) {
    return <div className={cn('relative block rounded-lg', className)}>{art}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${alt} — 눌러서 크게 보기`}
      className={cn('relative block rounded-lg', className)}
    >
      {art}
    </button>
  );
}
