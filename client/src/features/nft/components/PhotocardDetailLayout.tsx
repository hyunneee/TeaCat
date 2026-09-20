import type { ReactNode } from 'react';

/** 모바일 세로 배치, 데스크톱 이미지 45%·거래 정보 55%. 긴 패널을 고정하지 않는다. */
export function PhotocardDetailLayout({
  image,
  children,
}: {
  image: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8 lg:py-6"
      data-photocard-layout
    >
      <div
        className="surface-2 border-line border-b px-6 py-8 lg:rounded-2xl lg:border-0 lg:py-12"
        data-photocard-image
      >
        {image}
      </div>
      <div className="min-w-0 space-y-4 p-4 lg:p-0" data-photocard-panel>
        {children}
      </div>
    </div>
  );
}
