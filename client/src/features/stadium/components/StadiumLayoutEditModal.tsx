import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@/shared/components/ui';
import type {
  StadiumLayoutStatusValue,
  StadiumLayoutSummary,
  StadiumLayoutUpdateRequest,
} from '../model/stadium.types';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '작성 중' },
  { value: 'ACTIVE', label: '사용 가능' },
  { value: 'ARCHIVED', label: '보관됨' },
] as const;

export function StadiumLayoutEditModal({
  layout,
  isPending,
  onClose,
  onSubmit,
}: {
  layout: StadiumLayoutSummary | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (layoutId: number, body: StadiumLayoutUpdateRequest) => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<StadiumLayoutStatusValue>('DRAFT');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    setName(layout?.name ?? '');
    setStatus(layout?.status ?? 'DRAFT');
    setIsDefault(layout?.isDefault ?? false);
  }, [layout]);

  const changed =
    !!layout &&
    (name.trim() !== layout.name || status !== layout.status || isDefault !== layout.isDefault);

  const submit = () => {
    if (!layout || !name.trim() || !changed) return;
    const body: StadiumLayoutUpdateRequest = {};
    if (name.trim() !== layout.name) body.name = name.trim();
    if (status !== layout.status) body.status = status;
    if (isDefault !== layout.isDefault) body.isDefault = isDefault;
    onSubmit(layout.layoutId, body);
  };

  return (
    <Modal
      open={layout !== null}
      variant="center"
      width="wide"
      title="배치 정보 수정"
      description="이름과 사용 상태, 기본 배치 여부를 변경합니다."
      onClose={onClose}
      dismissible={!isPending}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="soft" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button
            variant="dark"
            onClick={submit}
            loading={isPending}
            disabled={!name.trim() || !changed}
          >
            저장
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Input
          label="배치 이름"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-sm font-medium">배치 상태</span>
          <Select
            label="배치 상태"
            value={status}
            options={layout?.isDefault ? STATUS_OPTIONS.filter((option) => option.value === 'ACTIVE') : STATUS_OPTIONS}
            onChange={(value) => {
              setStatus(value);
              if (value !== 'ACTIVE') setIsDefault(false);
            }}
          />
        </div>
        <label className="text-ink flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            disabled={layout?.isDefault}
            onChange={(event) => {
              setIsDefault(event.target.checked);
              if (event.target.checked) setStatus('ACTIVE');
            }}
          />
          <span>
            기본 배치로 지정
            {layout?.isDefault && (
              <span className="text-ink-muted mt-0.5 block text-xs">
                기본 배치는 다른 배치를 기본으로 지정하면 자동으로 변경됩니다.
              </span>
            )}
          </span>
        </label>
      </div>
    </Modal>
  );
}
