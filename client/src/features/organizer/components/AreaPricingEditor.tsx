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
  exceedsVenueCapacity,
  type AreaPricingRow,
} from '../model/areaPricing';

const SALE_TYPES = [
  { value: 'SEATED', label: '좌석 지정', Icon: Armchair },
  { value: 'STANDING', label: '스탠딩', Icon: Users },
] as const satisfies readonly { value: AreaType; label: string; Icon: typeof Armchair }[];

/**
 * 파는 방식 줄의 설명. 방식을 바꿀 수 없는 줄이면 **그 이유**를 먼저 말합니다.
 *
 * 예전에는 버튼의 `title` 만 있었는데, 마우스를 올려야 보여서 폰에서는 왜 눌리지 않는지
 * 알 방법이 없었습니다 — "스탠딩으로 두면 좌석으로 되돌릴 수 없다" 로 읽히던 문제입니다.
 */
function saleTypeHint(row: AreaPricingRow): string {
  if (row.soldCnt > 0) {
    return `이미 ${row.soldCnt}장 팔려서 파는 방식을 바꿀 수 없어요`;
  }
  if (!canSellSeated(row)) {
    return '공연장이 스탠딩으로 등록한 구역이라 좌석 지정으로는 팔 수 없어요';
  }
  return row.saleType === 'SEATED'
    ? `등록된 좌석 ${capacityOf(row)}석만큼 팝니다`
    : '좌석 없이 받을 인원만 정해서 팝니다';
}

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
 * 한 줄 = **공연장에 이미 등록된** 구역 하나. 구역과 좌석은 공연장의 것이라 여기서 만들지 않습니다.
 * 체크를 켜면 이 공연에서 판매하는 구역이 되고, 이 공연에서만 쓰는 등급·가격·수량을 적습니다.
 *
 * ⚠️ 저장은 PUT 이라 **목록에서 빠지면 삭제**입니다. 그래서 이미 팔린 구역은 체크를 잠가
 * 실수로 빠뜨려 저장 전체가 거절되는 일(AREA_MAX_CNT_BELOW_SOLD, 409)을 막습니다.
 * 티켓팅 시작 후 잠기는 항목을 다루는 ConcertForm 과 같은 방식입니다.
 *
 * 파는 방식(좌석제/스탠딩)도 줄마다 고릅니다. 좌석제 구역을 스탠딩으로 파는 것은 되지만
 * 그 반대는 막혀 있습니다 — 스탠딩 구역에는 배정할 좌석 좌표가 없습니다(서버 PERFORMANCE_022).
 * 팔린 뒤에는 방식을 바꿀 수 없어(PERFORMANCE_023) 체크와 함께 잠급니다.
 *
 * 세 번째 칸의 뜻이 방식에 따라 다릅니다. 좌석제면 최대 판매수량(좌석 수가 이미 상한),
 * 스탠딩이면 **받을 인원 상한**입니다 — 좌석 행이 없어 이 값이 인원을 제한하는 유일한 근거이고,
 * 그래서 스탠딩에서는 1명 이상이 필수입니다(서버 PERFORMANCE_024).
 *
 * 기본값은 좌석제면 등록 좌석 수, 스탠딩이면 구역의 최대 수용 인원입니다.
 * 다만 정원을 상한으로 걸지는 않고 경고만 띄웁니다 — 이유는 areaPricing.ts 의 검증 주석 참고.
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
        /* 저장을 막지 않는 주의사항. 막는 것은 error 로 따로 내려옵니다 */
        const warning = needsSeatWarning(row)
          ? '배치도에 좌석이 없어요. 공연장 관리에서 좌석을 등록해야 좌석맵이 보입니다.'
          : exceedsVenueCapacity(row)
            ? `공연장 구역 정원(${row.maxSeat}명)보다 많아요. 회차가 여러 개면 정상입니다.`
            : null;

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
                {/* 방식을 못 바꾸는 줄에서는 그 이유를 글로 보여줍니다.
                    버튼의 title 은 마우스를 올려야 보여서 폰에서는 아예 읽을 수 없습니다 */}
                <span className={cn('text-xs', warning ? 'text-warning' : 'text-subtle')}>
                  {warning ?? saleTypeHint(row)}
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
                {/* 좌석제는 배치도에 등록된 좌석 수가 곧 팔 수 있는 티켓 수라 적을 것이 없습니다.
                    스탠딩만 받을 인원을 직접 정합니다 — 좌석 행이 없어 이 값이 유일한 상한입니다 */}
                {row.saleType === 'STANDING' ? (
                  <Input
                    aria-label={`${row.label} 받을 인원`}
                    placeholder="받을 인원(명)"
                    inputMode="numeric"
                    value={row.maxCnt}
                    disabled={disabled}
                    onChange={(e) => onChange(index, { maxCnt: e.target.value.replace(/[^\d]/g, '') })}
                  />
                ) : (
                  <p
                    aria-label={`${row.label} 판매 가능 좌석`}
                    className="surface-sunken border-line text-subtle flex h-11 items-center justify-center rounded-xl border text-xs"
                  >
                    좌석 {row.seatCount}석
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-danger mt-2 text-xs">{error}</p>}
          </li>
        );
      })}
    </ul>
  );
}
