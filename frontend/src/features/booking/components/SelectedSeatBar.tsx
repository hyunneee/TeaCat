import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { AnimatedNumber } from '@/shared/components/ui';
import { popIn } from '@/shared/lib';
import type { Seat } from '../model/booking.types';

interface Props {
  seats: Seat[];
  sectionName: string;
  maxPerUser: number;
  onRemove: (seat: Seat) => void;
}

/** 선택한 좌석 칩 목록 + 합계. 하단 액션바 위에 붙습니다. */
export function SelectedSeatBar({ seats, sectionName, maxPerUser, onRemove }: Props) {
  const total = seats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {seats.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="scrollbar-none flex gap-1.5 overflow-x-auto"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {seats.map((seat) => (
                <motion.li key={seat.id} layout variants={popIn} initial="hidden" animate="show" exit="exit">
                  <button
                    type="button"
                    onClick={() => onRemove(seat)}
                    aria-label={`${sectionName} ${seat.row}열 ${seat.number}번 선택 해제`}
                    className="bg-brand-50 text-brand-800 border-line-strong hover:border-danger hover:text-danger flex shrink-0 items-center gap-1 rounded-full border py-1 pr-1.5 pl-2.5 text-xs font-semibold transition-colors"
                  >
                    {sectionName} {seat.row}열 {seat.number}번
                    <X size={13} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <span className="text-muted text-sm">
          <b className="text-brand-700">{seats.length}</b> / {maxPerUser}매 선택
        </span>
        <AnimatedNumber value={total} format="price" className="text-base font-bold" />
      </div>
    </div>
  );
}
