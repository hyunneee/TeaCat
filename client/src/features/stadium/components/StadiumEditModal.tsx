import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/shared/components/ui';
import type { StadiumSummary, StadiumUpdateRequest } from '../model/stadium.types';

export function StadiumEditModal({
  stadium,
  isPending,
  onClose,
  onSubmit,
}: {
  stadium: StadiumSummary | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (stadiumId: number, body: StadiumUpdateRequest) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setName(stadium?.name ?? '');
    setAddress(stadium?.address ?? '');
    setPhone(stadium?.phone ?? '');
  }, [stadium]);

  const valid = name.trim().length > 0 && address.trim().length > 0;
  const phoneChanged = phone.trim().length > 0 && phone.trim() !== (stadium?.phone ?? '');
  const changed =
    !!stadium &&
    (name.trim() !== stadium.name || address.trim() !== stadium.address || phoneChanged);

  const submit = () => {
    if (!stadium || !valid || !changed) return;
    const body: StadiumUpdateRequest = {};
    if (name.trim() !== stadium.name) body.name = name.trim();
    if (address.trim() !== stadium.address) body.address = address.trim();
    if (phoneChanged) body.phone = phone.trim();
    onSubmit(stadium.stadiumId, body);
  };

  return (
    <Modal
      open={stadium !== null}
      variant="center"
      width="wide"
      title="공연장 정보 수정"
      description="공연장 기본 정보를 수정합니다."
      onClose={onClose}
      dismissible={!isPending}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="soft" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button variant="dark" onClick={submit} loading={isPending} disabled={!valid || !changed}>
            저장
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-2">
        <Input
          label="공연장 이름"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="주소"
          required
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Input
          label="전화번호"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          hint="등록된 전화번호를 비우면 기존 번호가 유지됩니다."
        />
      </div>
    </Modal>
  );
}
