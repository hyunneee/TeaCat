import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button, IconButton } from '@/shared/components/ui';
import { Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { PocaPackArt, useClaimEventPack } from '@/features/nft';

/**
 * 이벤트 카드팩 **수령** 화면. 배너 링크(`linkPath: /nft/packs`)가 여기로 옵니다.
 *
 * 여기서는 받기만 합니다 — **뜯는 건 내 포토카드에서** 합니다.
 * 받자마자 뜯게 하면 "내 보관함에 팩이 생겼다" 는 사실이 화면에 남지 않습니다.
 *
 * 페이지는 조립만 합니다 — 청구도 판정도 훅과 서버가 합니다. (CLAUDE.md 3-6)
 */
export function PocaPackClaimPage() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useClaimEventPack();

  /* 🔴 `granted: false` 는 실패가 아닙니다 — 이미 받았거나 진행 중인 이벤트가 없는 것뿐입니다.
     서버는 이유를 구분해 주지 않으므로 화면도 단정하지 않습니다. */
  const granted = data?.granted === true;

  return (
    <div className="bg-poca-stage relative flex min-h-dvh flex-col text-white">
      <div className="pt-safe absolute top-0 left-0 z-30 p-1">
        <IconButton
          label="뒤로"
          onClick={() => navigate(-1)}
          className="text-white hover:bg-white/12 active:bg-white/20"
        >
          <ChevronLeft size={24} />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        {isPending ? (
          <Loading label="카드팩을 확인하는 중" />
        ) : (
          <>
            {/* 🔴 칸도 이름표도 없이 봉지만 둡니다 — 검은 화면에 흰 네모를 두르면
                봉지보다 그 네모가 먼저 보입니다 */}
            <PocaPackArt className="w-52" />

            <div className="space-y-2 text-center">
              <p className="text-xl font-extrabold">
                {granted ? '카드팩을 받았어요!' : '받을 수 있는 카드팩이 없어요'}
              </p>
              <p className="text-sm text-white/60">
                {isError
                  ? (error.message ?? '잠시 후 다시 시도해 주세요.')
                  : granted
                    ? '내 포토카드에서 열어볼 수 있어요.'
                    : '이미 받으셨거나 진행 중인 이벤트가 없어요.'}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="pb-safe px-4 pb-6">
        <Button fullWidth onClick={() => navigate(ROUTES.MY_NFTS, { replace: true })}>
          내 포토카드로 가기
        </Button>
      </div>
    </div>
  );
}
