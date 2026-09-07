import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmModalProps {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 되돌릴 수 없는 동작 — 붉은 띠 + 경고 아이콘 + 붉은 확인 버튼 */
  danger?: boolean;
  onConfirm: () => void;
  /**
   * 사용자가 취소했을 때 (취소 버튼·바깥 클릭·ESC 모두). 확인을 눌렀을 때는 불리지 않습니다.
   * "나가기 방지" 처럼 취소에도 할 일이 있는 경우에만 넘기세요.
   */
  onCancel?: () => void;
  /** 모달 시스템이 자동으로 주입합니다. 호출부에서 넘기지 않아도 됩니다. */
  onClose?: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
  onConfirm,
  onCancel,
  onClose = () => {},
}: ConfirmModalProps) {
  const cancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal
      variant="center"
      title={title}
      danger={danger}
      onClose={cancel}
      /* 두 버튼이 **서로 다른 무게**로 보여야 합니다.
         흰 모달 위에 흰 버튼(secondary) 둘을 나란히 두면 어느 쪽이 진행인지
         한눈에 안 들어옵니다. 취소는 회색 면, 확인은 채운 면입니다. */
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={cancel}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'dark'}
            fullWidth
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="bg-danger-soft text-danger flex size-9 shrink-0 items-center justify-center rounded-xl">
            <AlertTriangle size={18} />
          </span>
        )}
        {message && <p className="text-muted flex-1 text-sm leading-relaxed">{message}</p>}
      </div>
    </Modal>
  );
}
