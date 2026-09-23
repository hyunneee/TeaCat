import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/shared/components/layout';
import { ROUTES } from '@/shared/constants/routes';
import { AttendanceCalendarCard, useAttendanceCalendar } from '@/features/token';

/**
 * 출석 달력 — 지금까지 며칠 모았나.
 *
 * <p>출석 체크를 마치면 그 자리의 버튼이 여기로 옵니다. 받았다는 확인만 남겨 두면 그
 * 자리가 하루 종일 할 일이 없는데, 쌓인 기록은 내일 또 오게 만듭니다.
 *
 * <p>🔴 "오늘" 도 "며칠 연속" 도 <b>서버가 정합니다.</b> 기기 시계로 오늘을 판단하면
 * 자정 근처에서 도장이 하루 어긋나 보이고, 연속 일수는 한 달치 응답만으로는 월초에
 * 지난달에서 이어온 것이 빠집니다.
 */
export function AttendanceCalendarPage() {
  const navigate = useNavigate();
  /** undefined 면 이번 달입니다. 서버가 어느 달인지 정해서 돌려줍니다 */
  const [month, setMonth] = useState<string | undefined>(undefined);
  const { data: calendar, isPending } = useAttendanceCalendar(month);

  /* 이번 달인지는 서버가 준 today 로 판단합니다. 오지 않은 달은 볼 것이 없습니다 */
  const currentMonth = calendar?.today.slice(0, 7);
  const viewing = calendar?.month.slice(0, 7);

  return (
    <>
      {/* 🔴 이 화면은 PlainLayout 이라 하단 탭이 없습니다. 뒤로가기가 없으면 브라우저
          제스처 말고는 나갈 길이 아예 없습니다.

          navigate(-1) 대신 목적지를 못박는 이유는 들어오는 길이 캣치 화면의 "출석 달력
          보기" 하나뿐인데, 새로고침하거나 주소로 바로 들어오면 기록 한 칸 앞이 앱 밖이기
          때문입니다 — 그때 -1 은 티캣을 떠납니다. */}
      <Header title="출석 달력" showBack onBack={() => navigate(ROUTES.TOKEN)} />

      <div className="space-y-4 p-4">
        <AttendanceCalendarCard
          calendar={calendar}
          loading={isPending}
          onMonthChange={setMonth}
          atCurrentMonth={!!viewing && viewing === currentMonth}
        />
      </div>
    </>
  );
}

export default AttendanceCalendarPage;
