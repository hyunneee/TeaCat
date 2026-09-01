import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, House, ShieldCheck } from 'lucide-react';
import { Button, CatMascot } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';

/** 얼굴 등록 화면으로 오기 전에 가려던 곳 (RequireFace 가드가 넘겨준 값) */
interface FaceDoneState {
  from?: { pathname?: string };
}

/**
 * 얼굴 등록 완료.
 *
 * 등록은 이 앱에서 **딱 한 번** 하는 일이고, 그게 끝나야 티켓이 유효해집니다.
 * 그런 일이 상단 알림 한 줄로 지나가면 "된 건가?" 싶어 같은 화면을 또 찾아옵니다.
 * 회원가입 완료 화면과 같은 이유로 **화면 하나를 씁니다.** (SignupDonePage)
 *
 * 여기서 사진 이야기를 한 번 더 합니다 — 얼굴을 찍은 직후가
 * "내 사진이 어디로 갔나" 가 가장 궁금한 시점입니다. (CLAUDE.md 7장)
 */
export function FaceDonePage() {
  const navigate = useNavigate();
  const location = useLocation();

  /* 예매하러 가다가 등록 화면으로 보내진 경우엔 그 자리로 돌려보냅니다.
     그냥 마이페이지에서 등록한 사람은 마이페이지로. */
  const from = (location.state as FaceDoneState | null)?.from?.pathname;
  const nextLabel = from ? '이어서 진행하기' : '마이페이지로';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {/* 폭죽은 쓰지 않습니다 — 한 흐름의 끝(예매 완료)에서만 터집니다. (DESIGN.md) */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="surface-2 border-line relative flex size-24 items-center justify-center rounded-full border"
      >
        <CatMascot mood="happy" size={62} />

        {/* 완료 표시는 무채색입니다 — 강조색(초록)은 거래 확정·당첨에만 씁니다 */}
        <span className="bg-brand-900 border-surface-1 absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 text-white">
          <Check size={17} strokeWidth={3} />
        </span>
      </motion.div>

      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-bold">얼굴 등록이 완료됐어요</h1>
        <p className="text-subtle text-sm leading-relaxed">
          이제 예매한 티켓에 이 얼굴이 자동으로 매칭돼요.
          <br />
          입장할 때 본인 확인에만 사용됩니다.
        </p>
      </div>

      <p className="text-subtle surface-2 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs">
        <ShieldCheck size={15} className="shrink-0" />
        촬영한 사진은 기기 밖으로 나가지 않았어요
      </p>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button
          variant="dark"
          size="lg"
          fullWidth
          rightIcon={<ArrowRight size={18} />}
          onClick={() => navigate(from ?? ROUTES.MY, { replace: true })}
        >
          {nextLabel}
        </Button>
        <Button
          variant="ghost"
          fullWidth
          leftIcon={<House size={16} />}
          onClick={() => navigate(ROUTES.HOME, { replace: true })}
        >
          홈으로
        </Button>
      </div>
    </div>
  );
}
