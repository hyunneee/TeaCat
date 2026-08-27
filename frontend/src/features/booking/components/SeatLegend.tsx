import { SEAT_STATUS_LABEL } from '../model/seat.model';
import type { SeatStatus } from '../model/booking.types';

const ITEMS: { key: SeatStatus | 'SELECTED'; className: string }[] = [
  { key: 'AVAILABLE', className: 'bg-seat-available' },
  { key: 'SELECTED', className: 'bg-seat-selected' },
  { key: 'HELD', className: 'bg-seat-held' },
  { key: 'SOLD', className: 'bg-seat-sold' },
];

export function SeatLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
      {ITEMS.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[3px] ${item.className}`} aria-hidden />
          <span className="text-subtle">
            {item.key === 'SELECTED' ? '내가 선택' : SEAT_STATUS_LABEL[item.key]}
          </span>
        </li>
      ))}
    </ul>
  );
}
