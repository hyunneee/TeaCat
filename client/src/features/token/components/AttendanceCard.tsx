import { CalendarCheck, CalendarDays, Check, ChevronRight, Flame } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';

interface Props {
  /** 받으면 들어오는 금액. 아직 못 받아왔으면 null — 금액 없이 안내만 합니다 */
  amount: number | null;
  claimed: boolean;
  /** 오늘 현황을 받는 중 */
  loading: boolean;
  /** 지급을 청구하는 중 */
  claiming: boolean;
  /** 연속 출석 일수. 0이면 칩을 그리지 않습니다 */
  streak: number;
  onCheck: () => void;
  /** 받고 난 뒤 같은 자리에 뜨는 '출석 달력 보기' */
  onOpenCalendar: () => void;
}

/**
 * 출석 체크 — 누르면 캣머니를 받습니다.
 *
 * 🔴 **금액을 화면에 적지 않습니다.** 서버가 준 `amount` 를 그대로 씁니다 — 여기에 500 을
 * 박아 두면 금액을 바꿀 때 서버와 화면이 따로 놉니다. (`dailyReward.types` 주석)
 *
 * 🔴 받고 나면 버튼이 사라지지 않고 **출석 달력으로 가는 문**으로 바뀝니다. 잠긴 버튼만
 * 남겨 두면 그 자리가 "오늘은 끝" 만 말하고 더 할 일이 없습니다 — 내일 또 오게 만드는 건
 * 받았다는 확인이 아니라 지금까지 쌓인 기록입니다. 완료 여부는 제목 옆 칩이 말해 줍니다.
 */
export function AttendanceCard({
  amount,
  claimed,
  loading,
  claiming,
  streak,
  onCheck,
  onOpenCalendar,
}: Props) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="surface-2 text-brand-500 flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarCheck size={20} />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-bold">
            출석 체크
            {/* 🔴 연속 일수는 **서버가 셉니다.** 기기 시계로 세면 자정 근처에서 사람마다
                다르게 나오고, 마지막 출석이 어제보다 예전이면 서버가 0 을 줍니다 —
                여기서 "며칠째" 를 계산하지 마세요. */}
            {streak > 0 && (
              <span className="bg-accent-700 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white">
                <Flame size={11} aria-hidden />
                {streak}일째
              </span>
            )}
            {claimed && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <Check size={11} aria-hidden />
                완료
              </span>
            )}
          </p>
          <p className="text-muted text-xs">
            {claimed
              ? '오늘의 캣머니 보상을 받았어요. 내일 또 만나요.'
              : amount === null
                ? '하루 한 번 눌러서 캣머니를 받아요.'
                : `하루 한 번 누르면 캣머니 ${amount.toLocaleString()}을 드려요.`}
          </p>
        </div>
      </div>

      {/* 🔴 받고 나면 **같은 자리가 달력으로 가는 문**이 됩니다. 예전에는 잠긴 버튼이
          하루 종일 남아 있었는데, 그 자리는 "오늘은 끝" 만 말하고 더 할 일이 없었습니다.
          이제 누르면 지금까지 며칠 모았는지 보러 갑니다 — 내일 또 오게 만드는 건
          받았다는 확인이 아니라 쌓인 기록입니다. */}
      {claimed ? (
        <Button
          variant="secondary"
          size="md"
          fullWidth
          leftIcon={<CalendarDays size={16} />}
          rightIcon={<ChevronRight size={16} />}
          onClick={onOpenCalendar}
        >
          출석 달력 보기
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={loading}
          loading={claiming}
          onClick={onCheck}
        >
          {amount === null ? '출석 체크하기' : `출석 체크하고 ${amount.toLocaleString()} 받기`}
        </Button>
      )}

      {/* 🔴 체인 확정까지 약 10초입니다. 이 줄이 없으면 잔액이 그대로인 것을 보고
          안 받아졌다고 생각합니다 (`dailyReward.types` 주석) */}
      {claimed && <p className="text-subtle text-center text-xs">잔액 반영까지 잠시 걸려요.</p>}
    </Card>
  );
}
