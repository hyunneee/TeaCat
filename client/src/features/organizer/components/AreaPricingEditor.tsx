import { Armchair, Users } from 'lucide-react';
import { Badge, Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { GRADE_MAX_LENGTH, type AreaPricingRow } from '../model/areaPricing';

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
                  {row.type === 'SEATED' ? `좌석 ${row.capacity}석` : `스탠딩 · 최대 ${row.capacity}명`}
                  {row.soldCnt > 0 && ` · 전 회차 합계 ${row.soldCnt}장 판매됨`}
                </span>
              </span>
              <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? '판매' : '판매 안 함'}</Badge>
            </label>

            {row.enabled && (
              <div className="mt-3 grid grid-cols-3 gap-2">
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
