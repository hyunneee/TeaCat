import { useRef } from 'react';
import { cn } from '@/shared/lib';
import { DecorateSticker } from './DecorateSticker';
import type { Placed } from '../model/decoration.types';

interface Props {
  /** 카드 원본 그림 */
  imageUrl: string;
  designName: string;
  placed: Placed[];
  selectedId: string | null;
  /** null 이면 선택 해제 (빈 곳 탭) */
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Placed>) => void;
  onRemove: (id: string) => void;
  /** 합성에 쓸 카드 `<img>` 를 페이지에 넘깁니다 */
  registerCard: (el: HTMLImageElement | null) => void;
  registerSticker: (id: string, el: HTMLImageElement | null) => void;
  /** 카드 그림을 못 받았을 때 — 저장이 불가능하므로 페이지가 알려야 합니다 */
  onCardError?: () => void;
  className?: string;
}

/**
 * 꾸미기 판 — 카드 한 장과 그 위에 얹힌 스티커들.
 *
 * 🔴 **카드 그림에 높이를 강제하지 않습니다.** `w-full` 만 주고 높이는 그림이 정합니다.
 *    `aspect-[2/3]` + `object-cover` 로 잘라 보여주면 화면에서 보이는 자리와 내보내는
 *    캔버스(카드 원본 해상도 전체)의 자리가 어긋나서, 스티커가 결과물에서 밀립니다.
 *
 * 🔴 카드 `<img>` 에 **`crossOrigin="anonymous"`** 가 붙어 있어야 합니다.
 *    없으면 `toBlob()` 이 통째로 실패합니다 (`composeDecorated` 주석).
 *
 * 앞뒤 순서는 **배열 순서**입니다 — 나중 것이 위. 탭한 것을 맨 뒤로 옮기는 일은 페이지가 합니다
 * (상태를 들고 있는 쪽이 한 군데여야 합니다).
 */
export function DecorateCanvas({
  imageUrl,
  designName,
  placed,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  registerCard,
  registerSticker,
  onCardError,
  className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  /** 비율 좌표의 기준. 스티커들이 전부 이 하나를 봅니다 */
  const getCardRect = () => boxRef.current?.getBoundingClientRect() ?? null;

  return (
    <div
      ref={boxRef}
      /* 빈 곳을 누르면 선택 해제. 스티커는 `stopPropagation` 으로 여기까지 오지 않습니다 */
      onPointerDown={() => onSelect(null)}
      className={cn('relative w-full touch-none overflow-visible select-none', className)}
    >
      <img
        ref={registerCard}
        src={imageUrl}
        alt={`${designName} 포토카드`}
        crossOrigin="anonymous"
        draggable={false}
        onError={onCardError}
        className="shadow-card block w-full rounded-lg"
      />

      {placed.map((p) => (
        <DecorateSticker
          key={p.id}
          placed={p}
          selected={p.id === selectedId}
          getCardRect={getCardRect}
          onSelect={() => onSelect(p.id)}
          onChange={(patch) => onChange(p.id, patch)}
          onRemove={() => onRemove(p.id)}
          registerImg={(el) => registerSticker(p.id, el)}
        />
      ))}
    </div>
  );
}
