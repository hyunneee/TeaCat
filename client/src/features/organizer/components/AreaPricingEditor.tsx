import { Armchair, Users } from 'lucide-react';
import type { AreaType } from '@/features/concert';
import { Badge, Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import {
  GRADE_MAX_LENGTH,
  canSellSeated,
  capacityOf,
  changeSaleType,
  needsSeatWarning,
  type AreaPricingRow,
} from '../model/areaPricing';

const SALE_TYPES = [
  { value: 'SEATED', label: '좌석 지정', Icon: Armchair },
  { value: 'STANDING', label: '스탠딩', Icon: Users },
] as const satisfies readonly { value: AreaType; label: string; Icon: typeof Armchair }[];

interface Props {
  rows: AreaPricingRow[];
  /** 줄마다의 에러. 인덱스는 rows 와 같습니다 */
  errors: (string | undefined)[];
  onChange: (index: number, patch: Partial<AreaPricingRow>) => void;
  disabled?: boolean;
}

/**
 * 구역별 등급·가격 편집 (순수 View).
 *
 * 한 줄 = 공연장 구역 하나. 체크를 켜면 이 공연에서 판매하는 구역이 되고 등급·가격·최대 수량을 적습니다.
 *
 * ⚠️ 저장은 PUT 이라 **목록에서 빠지면 삭제**입니다. 그래서 이미 팔린 구역은 체크를 잠가
 * 실수로 빠뜨려 저장 전체가 거절되는 일(AREA_MAX_CNT_BELOW_SOLD, 409)을 막습니다.
 * 티켓팅 시작 후 잠기는 항목을 다루는 ConcertForm 과 같은 방식입니다.
 *
 * 파는 방식(좌석제/스탠딩)도 줄마다 고릅니다. 좌석제 구역을 스탠딩으로 파는 것은 되지만
 * 그 반대는 막혀 있습니다 — 스탠딩 구역에는 배정할 좌석 좌표가 없습니다(서버 PERFORMANCE_022).
 * 팔린 뒤에는 방식을 바꿀 수 없어(PERFORMANCE_023) 체크와 함께 잠급니다.
 *
 * 최대 수량 기본값은 좌석제면 등록 좌석 수, 스탠딩이면 최대 수용 인원입니다.
 * 다만 상한으로 걸지는 않습니다 — 이유는 areaPricing.ts 의 검증 주석 참고.
 */
export function AreaPricingEditor({ rows, errors, onChange, disabled = false }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-subtle py-3 text-center text-sm">
        이 공연장에 등록된 구역이 없어요. 공연장 관리에서 구역을 먼저 만들어 주세요.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => {
        const error = errors[index];
        const locked = disabled || row.soldCnt > 0;

        return (
          <li
            key={row.areaId}
            className={cn(
              'surface-2 rounded-2xl p-3.5 transition-opacity',
              !row.enabled && 'opacity-70',
              error && 'ring-danger ring-2',
            )}
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-current"
                checked={row.enabled}
                disabled={locked}
                onChange={(e) => onChange(index, { enabled: e.target.checked })}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.label}</span>
                <span className="text-subtle mt-0.5 flex items-center gap-1 text-xs">
                  {row.type === 'SEATED' ? <Armchair size={12} /> : <Users size={12} />}
                  {/* 공연장에 등록된 형태입니다. 이 공연에서 파는 방식은 아래 버튼으로 따로 고릅니다 */}
                  {row.type === 'SEATED'
                    ? `좌석 ${row.seatCount}석 · 최대 ${row.maxSeat}명`
                    : `스탠딩 · 최대 ${row.maxSeat}명`}
                  {row.soldCnt > 0 && ` · 전 회차 합계 ${row.soldCnt}장 판매됨`}
                </span>
              </span>
              <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? '판매' : '판매 안 함'}</Badge>
            </label>

            {row.enabled && (
              <div
                className="mt-3 flex flex-wrap items-center gap-2"
                role="group"
                aria-label={`${row.label} 파는 방식`}
              >
                <span className="text-subtle text-xs font-medium">파는 방식</span>
                <div className="surface-sunken border-line flex rounded-xl border p-0.5">
                  {SALE_TYPES.map(({ value, label, Icon }) => {
                    const active = row.saleType === value;
                    /* 스탠딩 구역에는 좌석 좌표가 없어 좌석 지정으로 팔 수 없습니다 */
                    const unavailable = value === 'SEATED' && !canSellSeated(row);

                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        disabled={locked || unavailable}
                        title={
                          unavailable
                            ? '스탠딩 구역에는 지정할 좌석이 없어요.'
                            : row.soldCnt > 0
                              ? '판매 이력이 있어 방식을 바꿀 수 없어요.'
                              : undefined
                        }
                        onClick={() => onChange(index, changeSaleType(row, value))}
                        className={cn(
                          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                          'transition-colors duration-150',
                          active ? 'surface-strong' : 'text-ink-subtle hover:text-ink-muted',
                          (locked || unavailable) && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <Icon size={12} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <span className={cn('text-xs', needsSeatWarning(row) ? 'text-warning' : 'text-subtle')}>
                  {needsSeatWarning(row)
                    ? '배치도에 좌석이 없어요. 공연장 관리에서 좌석을 등록해야 좌석맵이 보입니다.'
                    : row.saleType === 'SEATED'
                      ? `좌석 ${capacityOf(row)}석을 그대로 팝니다`
                      : `좌석 없이 ${capacityOf(row)}명까지 수량으로 팝니다`}
                </span>
              </div>
            )}

            {row.enabled && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Input
                  aria-label={`${row.label} 등급`}
                  placeholder="등급 (VIP)"
                  value={row.grade}
                  maxLength={GRADE_MAX_LENGTH}
                  disabled={disabled}
                  onChange={(e) => onChange(index, { grade: e.target.value })}
                />
                <Input
                  aria-label={`${row.label} 가격`}
                  placeholder="가격(원)"
                  inputMode="numeric"
                  value={row.price}
                  disabled={disabled}
                  onChange={(e) => onChange(index, { price: e.target.value.replace(/[^\d]/g, '') })}
                />
                <Input
                  aria-label={`${row.label} 최대 판매수량`}
                  placeholder="최대 수량"
                  inputMode="numeric"
                  value={row.maxCnt}
                  disabled={disabled}
                  onChange={(e) => onChange(index, { maxCnt: e.target.value.replace(/[^\d]/g, '') })}
                />
              </div>
            )}

            {error && <p className="text-danger mt-2 text-xs">{error}</p>}
          </li>
        );
      })}
    </ul>
  );
}
