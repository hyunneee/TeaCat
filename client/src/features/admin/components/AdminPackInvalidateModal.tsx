import { useEffect, useState } from 'react';
import { Button, Modal, Textarea } from '@/shared/components/ui';
import type { AdminPhotocardPack } from '../model/adminPhotocardPack.types';

interface Props {
  pack: AdminPhotocardPack | null;
  loading: boolean;
  onClose: () => void;
  onInvalidate: (reason: string) => Promise<void>;
}

export function AdminPackInvalidateModal({ pack, loading, onClose, onInvalidate }: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => setReason(''), [pack?.packId]);

  if (!pack) return null;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    await onInvalidate(trimmed);
  };

  return (
    <Modal
      open
      danger
      dismissible={!loading}
      variant="center"
      width="wide"
      title="카드팩을 무효화할까요?"
      description={`${pack.title ?? '카드팩'} (#${pack.packId})을 개봉 대상에서 제외합니다. 지급 이력은 남습니다.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={loading} onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={!reason.trim()}
            onClick={() => void submit()}
          >
            무효화
          </Button>
        </div>
      }
    >
      <Textarea
        label="무효화 사유"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="잘못 지급된 이유를 입력해 주세요."
        rows={4}
        maxLength={500}
        showCount
        required
      />
    </Modal>
  );
}
