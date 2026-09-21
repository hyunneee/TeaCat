import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useBookingAccess } from '@/features/concert';
import { ApiError } from '@/shared/api';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';

/** 결제 진행/결과에는 적용하지 않는다. 선점 이전의 예매 화면 진입만 확인한다. */
export function RequireBookingAccess() {
  const { scheduleId = '' } = useParams();
  const location = useLocation();

  // 같은 회차라도 앞으로/뒤로 이동하면 이전 OPEN 응답으로 자식 화면을 열지 않는다.
  return <BookingAccessCheck key={location.key} scheduleId={scheduleId} entryKey={location.key} />;
}

function BookingAccessCheck({ scheduleId, entryKey }: { scheduleId: string; entryKey: string }) {
  const navigate = useNavigate();
  const check = useBookingAccess(scheduleId, entryKey);
  const missing =
    !check.validId || (ApiError.isApiError(check.error) && check.error.status === 404);

  const paused = check.fetchStatus === 'paused';
  if (!missing && !paused && (check.isPending || check.isFetching)) {
    return <PageLoader />;
  }

  const schedule = check.data;
  const failed = paused || check.isError || !schedule || !check.isFetchedAfterMount;
  // SOLDOUT은 기존 좌석 선점 때문에도 발생한다. 이를 종료로 취급하지 않는다.
  const accessible = schedule?.bookingStatus === 'OPEN' || schedule?.bookingStatus === 'SOLDOUT';

  if (!missing && !failed && accessible) return <Outlet />;

  const title = missing
    ? '회차를 찾을 수 없어요'
    : failed
      ? '예매 상태를 확인하지 못했어요'
      : schedule.bookingStatus === 'CLOSED'
        ? '예매가 종료된 회차예요'
        : schedule.bookingStatus === 'BEFORE'
          ? '아직 예매가 시작되지 않았어요'
          : '예매 상태를 확인하지 못했어요';

  return (
    <>
      <Header title="예매 안내" />
      <EmptyState
        title={title}
        description={
          missing
            ? '주소가 잘못되었거나 공개되지 않은 회차입니다.'
            : failed
              ? '잠시 후 다시 시도해 주세요.'
              : '공연 상세에서 예매 가능한 회차를 확인해 주세요.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {!missing && failed && <Button onClick={() => void check.refetch()}>다시 시도</Button>}
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  !missing && schedule
                    ? ROUTES.CONCERT_DETAIL(String(schedule.concertId))
                    : ROUTES.CONCERTS,
                  { replace: true },
                )
              }
            >
              {!missing && schedule ? '공연 상세로' : '공연 목록으로'}
            </Button>
          </div>
        }
      />
    </>
  );
}
