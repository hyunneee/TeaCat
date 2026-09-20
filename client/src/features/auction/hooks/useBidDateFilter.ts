import { useSearchParams } from 'react-router-dom';
import {
  BID_PERIODS,
  bidDateError,
  presetBidDates,
  type BidPeriod,
} from '../model/auctionOptions.model';

export function useBidDateFilter() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  const dates = { from, to };
  const savedPeriod = params.get('period');
  const period: BidPeriod =
    from === undefined && to === undefined
      ? 'all'
      : (BID_PERIODS.find((item) => item.value === savedPeriod && item.value !== 'all')?.value ??
        'custom');

  function selectPeriod(value: BidPeriod) {
    const next = new URLSearchParams(params);
    const range = value === 'custom' && from && to ? dates : presetBidDates(value);
    next.delete('cursor');
    next.set('period', value);
    if (range.from && range.to) {
      next.set('from', range.from);
      next.set('to', range.to);
    } else {
      next.delete('from');
      next.delete('to');
      next.delete('period');
    }
    setParams(next, { replace: true });
  }

  function changeDate(field: 'from' | 'to', value: string) {
    const next = new URLSearchParams(params);
    next.set(field, value);
    next.set('period', 'custom');
    next.delete('cursor');
    setParams(next, { replace: true });
  }

  return { dates, period, selectPeriod, changeDate, error: bidDateError(dates) };
}
