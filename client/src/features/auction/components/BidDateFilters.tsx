import { Button, Input } from '@/shared/components/ui';
import { BID_PERIODS, type BidDateFilter, type BidPeriod } from '../model/auctionOptions.model';

interface Props {
  dates: BidDateFilter;
  period: BidPeriod;
  selectPeriod: (period: BidPeriod) => void;
  changeDate: (field: 'from' | 'to', value: string) => void;
  error: string | null;
}

export function BidDateFilters({ dates, period, selectPeriod, changeDate, error }: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="입찰 조회 기간">
        {BID_PERIODS.map((item) => (
          <Button
            key={item.value}
            variant={period === item.value ? 'dark' : 'secondary'}
            aria-pressed={period === item.value}
            onClick={() => selectPeriod(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Input
              label="시작일"
              type="date"
              value={dates.from ?? ''}
              max="9999-12-31"
              onChange={(e) => changeDate('from', e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <Input
              label="종료일"
              type="date"
              value={dates.to ?? ''}
              max="9999-12-31"
              onChange={(e) => changeDate('to', e.target.value)}
            />
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p className="text-subtle text-xs">
          {dates.from ? `${dates.from} ~ ${dates.to} · ` : ''}한국 시간 기준 입찰 내역이에요. 내
          최고 입찰가는 전체 기간 기준이에요.
        </p>
      )}
    </div>
  );
}
