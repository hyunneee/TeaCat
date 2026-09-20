import { useId } from 'react';

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

/** 긴 시간 목록은 모바일에서도 OS의 기본 선택창으로 조작한다. */
export function AuctionDurationPicker({ value, onChange }: Props) {
  const id = useId();
  const days = Math.floor(value / 1440);
  const hours = Math.floor((value % 1440) / 60);
  const minutes = value % 60;
  const fields = [
    { name: '일', value: days, count: 8, update: (v: number) => v * 1440 + hours * 60 + minutes },
    {
      name: '시간',
      value: hours,
      count: days === 7 ? 1 : 24,
      update: (v: number) => days * 1440 + v * 60 + minutes,
    },
    {
      name: '분',
      value: minutes,
      count: days === 7 ? 1 : 60,
      update: (v: number) => days * 1440 + hours * 60 + v,
    },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-muted text-sm">진행 시간 선택</legend>
      <div className="grid grid-cols-3 gap-2">
        {fields.map((field, index) => (
          <div key={field.name} className="min-w-0 space-y-1.5">
            <label htmlFor={`${id}-${index}`} className="text-muted text-sm">
              {field.name}
            </label>
            <select
              id={`${id}-${index}`}
              value={field.value}
              className="surface-2 text-ink focus-visible:ring-brand-900 h-12 w-full rounded-xl px-3 focus-visible:ring-2"
              onChange={(event) =>
                onChange(Math.min(10080, Math.max(30, field.update(Number(event.target.value)))))
              }
            >
              {Array.from({ length: field.count }, (_, number) => (
                <option
                  key={number}
                  value={number}
                  disabled={index === 2 && days === 0 && hours === 0 && number < 30}
                >
                  {number}
                  {field.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="text-subtle text-xs" aria-live="polite">
        선택한 기간:{' '}
        {[days && `${days}일`, hours && `${hours}시간`, minutes && `${minutes}분`]
          .filter(Boolean)
          .join(' ')}{' '}
        · 최소 30분, 최대 7일
      </p>
    </fieldset>
  );
}
