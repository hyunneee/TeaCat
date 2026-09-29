import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Input, Modal, Segmented } from '@/shared/components/ui';
import { drawMessageOf, POCA_ROLES, withPocaRole, type PocaRole } from '@/features/nft';
import { DESIGN_NAME_MAX, gradeForRole } from '../model/adminPocaDesign.model';
import type { AdminPocaTemplateCreateRequest } from '../model/adminPocaDesign.types';

const ROLES = POCA_ROLES.map((role) => ({ value: role, label: role }));

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
  const [role, setRole] = useState<PocaRole>('코치');
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

    /* 🔴 역할을 소속에 적어 넣습니다. 예전처럼 소속이 '서울' 로 시작하는지 보고 추측하면,
       교육생이 사실대로 '서울 5반' 이라 적는 순간 코치님이 되어 버립니다 */
    onSubmit({
      name: name.trim(),
      group: withPocaRole(group, role),
      grade: gradeForRole(role),
      image,
    });
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
          hint="어드민 목록에서 구분하려고 씁니다. 호칭은 아래 역할이 정합니다"
        />

        <div className="space-y-1.5">
          <p className="text-ink-muted text-sm font-medium">역할</p>
          <Segmented options={ROLES} value={role} onChange={setRole} />
          <p className="text-ink-subtle text-xs">파트장님·코치·교육생은 금색, 개발자는 보라로 나옵니다.</p>
        </div>

        {/* 등록하기 전에 무슨 말이 나올지 그대로 보여줍니다 — 호칭이 틀린 채로 뿌리면 되돌릴 수 없습니다 */}
        {name.trim() && (
          <p className="surface-2 text-ink-muted rounded-xl p-3 text-sm">
            뽑으면 이렇게 나옵니다 —{' '}
            <b className="text-ink">
              {drawMessageOf(name.trim(), withPocaRole(group, role), gradeForRole(role))}
            </b>
          </p>
        )}
      </div>
    </Modal>
  );
}
