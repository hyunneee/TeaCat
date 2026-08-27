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
  onClose = () => {},
}: ConfirmModalProps) {
  return (
    <Modal
      variant="center"
      title={title}
      danger={danger}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
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
