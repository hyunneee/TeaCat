import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { useManagedConcerts, useMyConcert } from '@/features/organizer';
import {
  OperationsAttendeePanel,
  OperationsAttendeeTable,
  OperationsAttendeeToolbar,
  OperationsSeatLegend,
  OperationsSeatMap,
  OperationsStandingList,
  OperationsSummaryBar,
  useSeatOperations,
} from '@/features/operations';

/**
 * 운영 콘솔 — 좌석·예매자.
 *
 * 담당 공연의 회차 하나를 골라 좌석 현황과 예매자 명단을 봅니다.
 * **검표는 여기서 하지 않습니다** — 카메라가 필요한 입장 처리는 [입장 확인] 탭의 일이고,
 * 넓은 좌석맵과 카메라를 한 화면에 함께 올리지 않기로 했습니다.
 *
 * 🔴 **공연·회차 필터는 이 화면 안에 있습니다.** 입장 확인 탭과 공통 필터를 만들지 않습니다 —
 *    두 화면은 하는 일이 달라서 선택 상태를 공유하면 한쪽에서 바꾼 회차가 다른 쪽의 작업을
 *    조용히 바꿔 놓습니다. 회차를 넘겨야 할 때는 오른쪽 패널의 이동 버튼처럼 명시적으로 넘깁니다.
 */
export function AdminSeatAttendeesPage() {
  const navigate = useNavigate();
  const [concertId, setConcertId] = useState('');
  const [scheduleId, setScheduleId] = useState('');

  const { concerts } = useManagedConcerts();
  const { data: concert } = useMyConcert(concertId);

  const operations = useSeatOperations(
    concertId ? Number(concertId) : null,
    scheduleId ? Number(scheduleId) : null,
  );
  const { seatMap, attendees, query } = operations;

  const concertOptions = [
    { value: '', label: '공연을 고르세요' },
    ...(concerts ?? []).map((item) => ({ value: String(item.concertId), label: item.title })),
  ];

  const scheduleOptions = [
    { value: '', label: '회차를 고르세요' },
    ...(concert?.schedules ?? []).map((item) => ({
      value: String(item.scheduleId),
      label: `${item.performanceNum}회차 · ${formatDateTime(item.performanceDate)}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">좌석·예매자</h1>
        <p className="text-ink-muted text-sm">
          담당 공연 회차의 좌석 현황과 예매자 명단을 확인합니다. 예매자 이름·연락처는 일부만
          보입니다.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Select
          label="공연"
          options={concertOptions}
          value={concertId}
          onChange={(value) => {
            setConcertId(value);
            /* 공연이 바뀌면 회차부터 다시 골라야 합니다 — 남은 회차 ID 는 다른 공연의 것입니다.
               선택·명단 필터는 훅이 회차 변경을 보고 비웁니다 (useSeatOperations 주석) */
            setScheduleId('');
          }}
        />
        <Select
          label="회차"
          options={scheduleOptions}
          value={scheduleId}
          onChange={setScheduleId}
        />
        {!scheduleId && (
          <p className="text-ink-muted text-xs">공연과 회차를 고르면 좌석 현황이 나타납니다.</p>
        )}
      </Card>

      {scheduleId &&
        (seatMap.isPending ? (
          <Loading label="좌석 현황을 불러오는 중" />
        ) : seatMap.isError || !seatMap.data ? (
          <EmptyState
            title="좌석 현황을 불러오지 못했어요"
            description="담당 공연의 회차인지 확인하고 잠시 후 다시 시도해 주세요."
          />
        ) : (
          <>
            <Card>
              <OperationsSummaryBar
                summary={seatMap.data.summary}
                serverTime={seatMap.data.serverTime}
                isRefreshing={seatMap.isFetching}
                onRefresh={() => void seatMap.refetch()}
              />
            </Card>

            {/* 좌석맵 + 선택 상세. 운영 콘솔은 좁은 화면에서 안내만 띄우므로(AdminLayout)
                여기서는 넓은 화면의 2단만 다룹니다. */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card className="flex min-h-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Select
                    label="구역"
                    options={[
                      { value: '', label: '전 구역' },
                      ...operations.areas.map((area) => ({
                        value: String(area.areaId),
                        label: `${area.areaCode}구역${area.grade ? ` · ${area.grade}석` : ''}`,
                      })),
                    ]}
                    value={query.areaId === null ? '' : String(query.areaId)}
                    onChange={(value) => operations.filterArea(value === '' ? null : Number(value))}
                  />
                  <OperationsSeatLegend className="ml-auto" />
                </div>

                {operations.drawnAreas.length === 0 ? (
                  <p className="text-ink-muted py-12 text-center text-sm">
                    {operations.hasSeatedAreas
                      ? '고른 구역에는 그릴 좌석이 없어요.'
                      : operations.standingAreas.length > 0
                        ? '이 회차는 좌석 배치가 없는 스탠딩 구역만 있어요.'
                        : '아직 좌석이 만들어지지 않은 회차예요.'}
                  </p>
                ) : (
                  <OperationsSeatMap
                    areas={operations.drawnAreas}
                    selectedTicketId={operations.selectedTicketId}
                    onSelectSeat={(seat) =>
                      seat.ticketId != null && operations.select(seat.ticketId)
                    }
                  />
                )}
              </Card>

              <div className="space-y-4">
                <OperationsAttendeePanel
                  detail={operations.detail.data}
                  isLoading={operations.detail.isPending && operations.selectedTicketId !== null}
                  isError={operations.detail.isError}
                  empty={operations.selectedTicketId === null}
                  /* 고른 회차를 들고 갑니다 — 검표 화면에서 다시 고르지 않게.
                     전역 공통 필터를 만드는 것이 아니라 이 이동에서만 건넵니다. */
                  onGoCheckIn={() =>
                    navigate(ROUTES.ADMIN_CHECK_IN, { state: { concertId, scheduleId } })
                  }
                />
                <OperationsStandingList
                  areas={operations.standingAreas}
                  selectedAreaId={query.areaId}
                  onPickArea={operations.filterArea}
                />
              </div>
            </div>

            <Card padded={false} className="overflow-hidden">
              <OperationsAttendeeToolbar
                query={query}
                areas={operations.areas}
                totalCount={operations.totalCount}
                onSearch={operations.search}
                onFilterArea={operations.filterArea}
                onFilterCheckIn={operations.filterCheckIn}
              />

              <OperationsAttendeeTable
                rows={operations.attendeeRows}
                isLoading={attendees.isPending}
                selectedTicketId={operations.selectedTicketId}
                onSelect={operations.select}
                hasMore={!!attendees.hasNextPage}
                isLoadingMore={attendees.isFetchingNextPage}
                onMore={() => void attendees.fetchNextPage()}
                filtered={
                  query.keyword.trim() !== '' || query.areaId !== null || query.checkIn !== 'ALL'
                }
              />
            </Card>
          </>
        ))}
    </div>
  );
}
