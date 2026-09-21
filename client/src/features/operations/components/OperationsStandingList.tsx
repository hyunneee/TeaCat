import { Card } from '@/shared/components/ui';
import { checkInRatio } from '../model/operations.model';
import type { OperationsArea } from '../model/operations.types';

interface Props {
  areas: OperationsArea[];
  /** 누르면 명단을 그 구역으로 거릅니다 — 스탠딩은 자리가 없어 명단이 유일한 확인 수단입니다 */
  onPickArea: (areaId: number) => void;
  selectedAreaId: number | null;
}

/**
 * 스탠딩 구역 (순수 View).
 *
 * 🔴 **가짜 좌석 번호를 만들지 않습니다.** 스탠딩에도 정원만큼의 좌석 행이 DB 에 있지만
 *    좌표가 없어서, 도면에 뿌리면 존재하지 않는 자리 번호를 운영자에게 보여주는 셈입니다.
 *    정원·예매·입장 수를 보여주고, 사람은 명단으로 확인합니다.
 */
export function OperationsStandingList({ areas, onPickArea, selectedAreaId }: Props) {
  if (areas.length === 0) return null;

  return (
    <section aria-label="스탠딩 구역" className="space-y-2">
      <h2 className="text-ink text-sm font-semibold">스탠딩 구역</h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => {
          const ratio = Math.round(checkInRatio(area.bookedCount, area.checkedInCount) * 100);
          const selected = area.areaId === selectedAreaId;

          return (
            <li key={area.areaId}>
              {/* `interactive` 가 있어야 키보드로도 눌립니다 (Card 주석) */}
              <Card
                interactive
                className={selected ? 'border-accent-700 space-y-1.5 border' : 'space-y-1.5'}
                onClick={() => onPickArea(area.areaId)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-ink text-sm font-bold">{area.areaCode}구역</p>
                  {area.grade && <p className="text-ink-muted text-xs">{area.grade}석</p>}
                </div>
                <dl className="text-ink-muted flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  <div className="flex gap-1">
                    <dt>정원</dt>
                    <dd className="text-ink font-semibold tabular-nums">{area.capacity}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>예매</dt>
                    <dd className="text-ink font-semibold tabular-nums">{area.bookedCount}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>입장</dt>
                    <dd className="text-ink font-semibold tabular-nums">
                      {area.checkedInCount}
                      <span className="text-ink-muted ml-1 font-medium">{ratio}%</span>
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
