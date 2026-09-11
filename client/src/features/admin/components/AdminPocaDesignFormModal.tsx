import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Input, Modal, Segmented } from '@/shared/components/ui';
import type { AdminPocaDesignCreateRequest, PocaDesignGrade } from '../model/adminPocaDesign.types';

/** 서버 제한과 같은 값 (`@Max(100_000)`) */
const SUPPLY_MAX = 100_000;

const GRADES: { value: PocaDesignGrade; label: string }[] = [
  { value: 'SPECIAL', label: '금색 (코치·교육생)' },
  { value: 'COMMON', label: '보라 (개발자)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  onSubmit: (body: AdminPocaDesignCreateRequest) => void;
}

/**
 * 뽑기 풀 도안 등록.
 *
 * 🔴 **한정 수량은 첫 장이 발급되는 순간 온체인에서 동결됩니다.** 그 뒤로는 아무도 못 바꿉니다 —
 * 그래서 폼에서 한 번 더 말해 줍니다.
 *
 * 그림은 서버가 IPFS 에 올립니다. 프론트는 파일만 넘기고 CID 도 키도 모릅니다.
 */
export function AdminPocaDesignFormModal({ open, onClose, isPending, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [grade, setGrade] = useState<PocaDesignGrade>('SPECIAL');
  const [totalSupply, setTotalSupply] = useState('100');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const supply = Number(totalSupply);
  const canSubmit =
    name.trim().length > 0 &&
    group.trim().length > 0 &&
    image !== null &&
    supply > 0 &&
    supply <= SUPPLY_MAX;

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = () => {
    setSubmitted(true);
    if (!canSubmit || !image) return;

    onSubmit({
      name: name.trim(),
      group: group.trim(),
      grade,
      totalSupply: supply,
      image,
      /* 뽑기 풀 도안이라 공연은 비웁니다 — 서버가 둘 다 있으면 거절합니다 */
      drawPool: true,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="뽑기 도안 등록"
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button variant="dark" fullWidth loading={isPending} onClick={submit}>
            등록
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 그림 — 서버가 IPFS 에 핀합니다 */}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-line hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left"
          >
            {preview ? (
              <img src={preview} alt="" className="h-20 w-14 rounded-lg object-cover" />
            ) : (
              <span className="surface-2 text-ink-muted flex h-20 w-14 items-center justify-center rounded-lg">
                <ImagePlus size={18} />
              </span>
            )}
            <span className="text-ink-muted text-sm">
              {image ? image.name : '카드 그림을 고르세요 (2:3 권장)'}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {submitted && !image && <p className="text-danger mt-1 text-xs">그림을 골라 주세요.</p>}
        </div>

        <Input
          label="이름"
          showRequirement
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="김예린"
          hint="지갑과 카드 화면에 그대로 뜹니다"
        />

        <Input
          label="소속"
          showRequirement
          required
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="서울 5반"
          hint="'서울' 로 시작하면 화면에서 '코치님', 아니면 '교육생' 으로 부릅니다"
        />

        <div className="space-y-1.5">
          <p className="text-ink-muted text-sm font-medium">연출 등급</p>
          <Segmented options={GRADES} value={grade} onChange={setGrade} />
        </div>

        <Input
          label="한정 수량"
          showRequirement
          required
          value={totalSupply}
          onChange={(e) => setTotalSupply(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          hint="🔴 첫 장이 발급되면 온체인에서 동결돼 바꿀 수 없습니다. 소진되면 뽑기 풀에서 빠집니다"
        />
      </div>
    </Modal>
  );
}
