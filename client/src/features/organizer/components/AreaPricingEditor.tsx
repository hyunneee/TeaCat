import { useMemo, useState } from 'react';
import { Armchair, Info, Users } from 'lucide-react';
import { Button, Input } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import {
  AREA_GRADE_MAX_LENGTH,
  areAreaRowsValid,
  toAreaRows,
  validateAreaRows,
  type ConcertArea,
  type ConcertAreaRow,
} from '../model/organizer.types';

/**
 * 공연 구역 등급·가격 편집 (View 레이어).
 *
 * 공연장 배치도에 있는 구역을 전부 늘어놓고, **팔 구역만 체크**해서 등급·가격·수량을 매깁니다.
 * 저장은 PUT 이라 체크를 푼 구역은 서버에서 지워집니다 — 그래서 "저장하면 무엇이 사라지는지" 를
 * 버튼 옆에 적어 둡니다.
 *
 * 🔴 이미 팔린 구역은 체크를 풀 수 없게 막습니다. 서버도 거절하지만(AREA_MAX_CNT_BELOW_SOLD),
 *    누를 수 있게 두면 저장 버튼을 누른 뒤에야 알게 됩니다.
 */
export interface AreaPricingEditorProps {
  areas: ConcertArea[];
  saving: boolean;
  onSave: (rows: ConcertAreaRow[]) => void;
}

export function AreaPricingEditor({ areas, saving, onSave }: AreaPricingEditorProps) {
  /* 서버 값이 바뀌면(저장 성공 후 재조회) 폼도 새로 맞춥니다.
     areas 의 정체성은 공연 + 구역 구성이라 그것으로 키를 만듭니다. */
  const initialKey = useMemo(() => areas.map((a) => a.areaId).join(','), [areas]);
  const [rows, setRows] = useState<ConcertAreaRow[]>(() => toAreaRows(areas));
  const [loadedKey, setLoadedKey] = useState(initialKey);

  if (loadedKey !== initialKey) {
    setLoadedKey(initialKey);
    setRows(toAreaRows(areas));
  }

  const errors = validateAreaRows(rows);
  const valid = areAreaRowsValid(rows);
  const sellingCount = rows.filter((row) => row.selling).length;
  const removedCount = areas.filter(
    (area) => area.selling && !rows.find((row) => row.areaId === area.areaId)?.selling,
  ).length;

  const patch = (areaId: number, next: Partial<ConcertAreaRow>) =>
    setRows((prev) => prev.map((row) => (row.areaId === areaId ? { ...row, ...next } : row)));

  /* 처음 여는 구역은 배치도 좌석 수를 채워 줍니다. 대개 그 값이 맞고, 틀리면 고치면 됩니다 */
  const toggleSelling = (row: ConcertAreaRow, selling: boolean) =>
    patch(row.areaId, {
      selling,
      maxCnt: selling && row.maxCnt.trim() === '' ? String(row.capacity) : row.maxCnt,
    });

  if (areas.length === 0) {
    return (
      <EmptyState
        icon={Armchair}
        title="이 공연장에 구역이 없어요"
        description="좌석 배치 관리에서 구역을 먼저 만들어야 등급과 가격을 매길 수 있어요."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-ink-muted border-line border-b text-left text-xs">
              <th className="w-16 py-2 pr-2 font-medium">판매</th>
              <th className="py-2 pr-2 font-medium">구역</th>
              <th className="w-32 py-2 pr-2 font-medium">등급</th>
              <th className="w-36 py-2 pr-2 font-medium">가격 (원)</th>
              <th className="w-36 py-2 pr-2 font-medium">최대 판매수량</th>
              <th className="w-24 py-2 font-medium">판매됨</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const error = errors[row.areaId];
              const sold = row.soldCnt > 0;

              return (
                <tr key={row.areaId} className="border-line/60 border-b align-top">
                  <td className="py-2.5 pr-2">
                    <input
                      type="checkbox"
                      checked={row.selling}
                      /* 판매 이력이 있는 구역을 빼면 그 티켓의 가격 근거가 사라집니다 */
                      disabled={sold}
                      aria-label={`${row.areaCode} 구역 판매`}
                      onChange={(event) => toggleSelling(row, event.target.checked)}
                    />
                  </td>

                  <td className="py-2.5 pr-2">
                    <p className="text-ink font-medium">{row.areaCode}</p>
                    <p className="text-ink-subtle text-xs">
                      {row.levelCode ? `${row.levelCode} · ` : ''}
                      {row.areaType === 'SEATED' ? '좌석' : '스탠딩'} · {row.capacity}석
                    </p>
                  </td>

                  <td className="py-2.5 pr-2">
                    <Input
                      aria-label={`${row.areaCode} 구역 등급`}
                      value={row.grade}
                      disabled={!row.selling}
                      maxLength={AREA_GRADE_MAX_LENGTH}
                      placeholder="VIP"
                      onChange={(event) => patch(row.areaId, { grade: event.target.value })}
                    />
                  </td>

                  <td className="py-2.5 pr-2">
                    <Input
                      aria-label={`${row.areaCode} 구역 가격`}
                      value={row.price}
                      disabled={!row.selling}
                      inputMode="numeric"
                      placeholder="165000"
                      onChange={(event) =>
                        patch(row.areaId, { price: event.target.value.replace(/\D/g, '') })
                      }
                    />
                  </td>

                  <td className="py-2.5 pr-2">
                    <Input
                      aria-label={`${row.areaCode} 구역 최대 판매수량`}
                      value={row.maxCnt}
                      disabled={!row.selling}
                      inputMode="numeric"
                      placeholder={String(row.capacity)}
                      onChange={(event) =>
                        patch(row.areaId, { maxCnt: event.target.value.replace(/\D/g, '') })
                      }
                    />
                  </td>

                  <td className="text-ink-muted py-2.5 text-xs tabular-nums">
                    {row.soldCnt}장
                    {error && <p className="text-danger mt-1 leading-snug">{error}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 좌석은 회차마다 따로 만듭니다. 구역만 열어두고 좌석 생성을 잊으면
          예매 화면에 좌석이 하나도 안 뜨는데, 그 원인을 찾기가 아주 어렵습니다. */}
      <p className="text-ink-subtle flex items-start gap-1.5 text-xs leading-relaxed">
        <Info size={14} className="mt-px shrink-0" aria-hidden />
        구역을 새로 열었다면 회차별로 <b className="font-semibold">좌석 생성</b>을 다시 돌려야
        예매 화면에 좌석이 나타납니다.
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted flex items-center gap-1.5 text-xs">
          <Users size={14} aria-hidden />
          {sellingCount}개 구역 판매
          {removedCount > 0 && (
            <span className="text-danger">· 저장하면 {removedCount}개 구역이 내려갑니다</span>
          )}
        </p>
        <Button size="md" loading={saving} disabled={!valid} onClick={() => onSave(rows)}>
          구역 설정 저장
        </Button>
      </div>
    </div>
  );
}
