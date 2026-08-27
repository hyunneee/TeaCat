import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ConfirmModalProps } from '@/shared/components/ui';

/**
 * ┌─ 모달을 새로 추가하는 방법 (3단계) ────────────────────────┐
 * │ 1. 모달 컴포넌트를 해당 feature 의 components/ 에 만들고    │
 * │    그 feature 의 index.ts 에서 export 합니다.              │
 * │ 2. 아래 ModalPropsMap 에 "키: props타입" 한 줄 추가         │
 * │ 3. 아래 MODAL_REGISTRY 에 "키: lazy(...)" 한 줄 추가        │
 * └──────────────────────────────────────────────────────────┘
 *
 * 페이지 컴포넌트는 전혀 건드리지 않습니다.
 * 어디서든 `openModal('booking/seat-detail', { seatId })` 로 띄웁니다.
 * 키에 오타가 나거나 props 가 안 맞으면 컴파일 에러가 납니다.
 */

/** 모달 키 -> 그 모달이 받는 props */
export interface ModalPropsMap {
  'common/confirm': ConfirmModalProps;
  // 예시)
  // 'booking/seat-detail': { seatId: string };
  // 'nft/trade-offer': { nftId: string; ownerId: string };
}

export type ModalKey = keyof ModalPropsMap;

/* 모달마다 props 타입이 다르므로 레지스트리 값에서는 느슨하게 둡니다.
   타입 안전성은 useModal() 의 제네릭이 ModalPropsMap 으로 보장합니다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModalComponent = LazyExoticComponent<ComponentType<any>>;

export const MODAL_REGISTRY: Record<ModalKey, AnyModalComponent> = {
  'common/confirm': lazy(() =>
    import('@/shared/components/ui').then((m) => ({ default: m.ConfirmModal })),
  ) as AnyModalComponent,
  // 'booking/seat-detail': lazy(() =>
  //   import('@/features/booking').then((m) => ({ default: m.SeatDetailModal })),
  // ) as AnyModalComponent,
};
