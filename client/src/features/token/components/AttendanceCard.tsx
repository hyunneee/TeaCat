import { CalendarCheck, Check } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';

interface Props {
  /** 받으면 들어오는 금액. 아직 못 받아왔으면 null — 금액 없이 안내만 합니다 */
  amount: number | null;
  claimed: boolean;
  /** 오늘 현황을 받는 중 */
  loading: boolean;
  /** 지급을 청구하는 중 */
  claiming: boolean;
  onCheck: () => void;
}

/**
 * 출석 체크 — 누르면 캣머니를 받습니다.
 *
 * 🔴 **금액을 화면에 적지 않습니다.** 서버가 준 `amount` 를 그대로 씁니다 — 여기에 500 을
 * 박아 두면 금액을 바꿀 때 서버와 화면이 따로 놉니다. (`dailyReward.types` 주석)
 *
 * 🔴 받고 나면 버튼을 **지우지 않고 잠급니다.** 사라지면 "눌렀던가?" 를 확인할 자리가
 * 없어집니다. 잠긴 버튼이 "오늘은 끝" 이라고 말해 줍니다.
 */
export function AttendanceCard({ amount, claimed, loading, claiming, onCheck }: Props) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="surface-2 text-brand-500 flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarCheck size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold">출석 체크</p>
          <p className="text-muted text-xs">
            {amount === null
              ? '하루 한 번 눌러서 캣머니를 받아요.'
              : `하루 한 번 누르면 캣머니 ${amount.toLocaleString()}을 드려요.`}
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={claimed || loading}
        loading={claiming}
        leftIcon={claimed ? <Check size={16} /> : undefined}
        onClick={onCheck}
      >
        {claimed
          ? '오늘 출석 완료'
          : amount === null
            ? '출석 체크하기'
            : `출석 체크하고 ${amount.toLocaleString()} 받기`}
      </Button>

      {/* 🔴 체인 확정까지 약 10초입니다. 이 줄이 없으면 잔액이 그대로인 것을 보고
          안 받아졌다고 생각합니다 (`dailyReward.types` 주석) */}
      {claimed && <p className="text-subtle text-center text-xs">잔액 반영까지 잠시 걸려요.</p>}
    </Card>
  );
}
