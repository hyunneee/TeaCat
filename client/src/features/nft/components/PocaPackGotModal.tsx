import { Button, Modal } from '@/shared/components/ui';
import { PocaPackArt } from './PocaPackArt';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 내 포토카드로 보냅니다 — 받은 팩이 실제로 놓인 자리입니다 */
  onGo: () => void;
}

/**
 * "카드팩을 받았어요" — 티켓을 사고 나면 예매 완료 화면에서 한 번 뜹니다.
 *
 * 🔴 **여는 시각을 단정하지 않습니다.** 공연 직전에 열린다는 것만 말하고, 정확한 시각은
 * 내 포토카드의 카드팩 칸이 서버 값(`nextOpenAt`)으로 보여 줍니다. 화면이 "몇 분 전" 을
 * 적으면 서버 설정이 바뀔 때 거짓말이 됩니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaPackGotModal({ open, onClose, onGo }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="카드팩을 받았어요!"
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={onClose}>
            나중에
          </Button>
          <Button variant="dark" fullWidth onClick={onGo}>
            보러 가기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <PocaPackArt className="w-28" />
        <p className="text-muted text-sm leading-relaxed">
          예매하신 공연의 <b className="text-ink">포토카드 팩</b>이 내 포토카드에 담겼어요.
          <br />
          공연 시작 직전에 열어볼 수 있습니다.
        </p>
      </div>
    </Modal>
  );
}
