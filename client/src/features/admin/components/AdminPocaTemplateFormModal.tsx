import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Input, Modal, Segmented } from '@/shared/components/ui';
import { DESIGN_NAME_MAX } from '../model/adminPocaDesign.model';
import type {
  AdminPocaTemplateCreateRequest,
  PocaDesignGrade,
} from '../model/adminPocaDesign.types';

const GRADES: { value: PocaDesignGrade; label: string }[] = [
  { value: 'SPECIAL', label: '금색 (코치·교육생)' },
  { value: 'COMMON', label: '보라 (개발자)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  onSubmit: (body: AdminPocaTemplateCreateRequest) => void;
}

/**
 * 카드 그림 등록.
 *
 * 🔴 **수량을 받지 않습니다.** 수량은 이 그림을 공연이나 이벤트 풀에 넣을 때 정합니다 —
 * 같은 그림이라도 공연마다 다른 온체인 카드가 되기 때문입니다.
 *
 * 그림은 서버가 IPFS 에 올립니다. 프론트는 파일만 넘기고 CID 도 키도 모릅니다.
 */
export function AdminPocaTemplateFormModal({ open, onClose, isPending, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [grade, setGrade] = useState<PocaDesignGrade>('SPECIAL');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    name.trim().length <= DESIGN_NAME_MAX &&
    group.trim().length > 0 &&
    image !== null;

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = () => {
    setSubmitted(true);
    if (!canSubmit || !image) return;

    onSubmit({ name: name.trim(), group: group.trim(), grade, image });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="카드 그림 등록"
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
          hint={`공연 풀에 넣으면 "이름 · 공연 제목" 이 되고, 합쳐서 ${DESIGN_NAME_MAX}자를 넘을 수 없습니다`}
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
      </div>
    </Modal>
  );
}
