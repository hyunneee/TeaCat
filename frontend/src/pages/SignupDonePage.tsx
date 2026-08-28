import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { House, LogIn } from 'lucide-react';
import { Button, CatMascot } from '@/shared/components/ui';
import { Confetti } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';

/**
 * 회원가입 완료.
 *
 * 가입 직후 자동으로 로그인시키지 않고 이 화면을 거칩니다.
 * "가입이 됐다"는 사실을 분명히 보여주는 편이,
 * 곧바로 홈으로 튕겨 보내는 것보다 사용자가 덜 불안합니다.
 */
export function SignupDonePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {/* 한 흐름이 끝나는 지점 — 여기서 한 번만 터뜨립니다 */}
      <Confetti />

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="surface-2 border-line flex size-24 items-center justify-center rounded-full border"
      >
        <CatMascot mood="happy" size={62} />
      </motion.div>

      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-bold">가입이 완료되었습니다</h1>
        <p className="text-subtle text-sm">
          로그인한 뒤 마이페이지에서 얼굴을 등록하면 예매할 수 있어요.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          leftIcon={<LogIn size={18} />}
          onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
        >
          로그인하러 가기
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
