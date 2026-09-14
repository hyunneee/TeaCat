import { useState } from 'react';
import { Button, Input, Modal } from '@/shared/components/ui';
import { EVENT_CODE_MAX, EVENT_NAME_MAX, normalizeEventCode } from '../model/adminPackEvent.model';
import type { AdminPackEventCreateRequest } from '../model/adminPackEvent.types';

interface Props {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  onSubmit: (body: AdminPackEventCreateRequest) => void;
}

/**
 * 카드팩 이벤트 등록.
 *
 * 🔴 **코드는 등록 뒤에 바꿀 수 없습니다.** 지급된 팩의 출처로 남아 계정당 1회를 판정하기
 * 때문입니다. 바꾸면 이미 받은 사람이 또 받습니다.
 *
 * 기간을 비워 두면 즉시 시작·무기한입니다. 시연용이라면 둘 다 비우는 게 가장 안전합니다 —
 * 시각을 잘못 넣으면 스위치가 켜져 있어도 팩이 나가지 않습니다.
 */
export function AdminPackEventFormModal({ open, onClose, isPending, onSubmit }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  /* 기간이 뒤집히면 서버가 400 입니다. 여기서 먼저 잡습니다 */
  const inverted = startsAt !== '' && endsAt !== '' && endsAt <= startsAt;
  const canSubmit = code.trim().length > 0 && name.trim().length > 0 && !inverted;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      code: code.trim(),
      name: name.trim(),
      /* 비운 칸은 빈 문자열이 아니라 null 이어야 "즉시·무기한" 이 됩니다 */
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="카드팩 이벤트 열기"
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button variant="dark" fullWidth loading={isPending} onClick={submit}>
            열기
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="이벤트 이름"
          showRequirement
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="시연 이벤트"
          maxLength={EVENT_NAME_MAX}
          hint="어드민 목록에서만 보입니다"
        />

        <Input
          label="구분 코드"
          showRequirement
          required
          value={code}
          onChange={(e) => setCode(normalizeEventCode(e.target.value))}
          placeholder="DEMO_2026"
          maxLength={EVENT_CODE_MAX}
          hint="사용자가 입력하는 번호가 아닙니다 — 누가 이미 받았는지 가리는 이름표입니다. 영문 대문자·숫자·밑줄만, 등록 뒤에는 바꿀 수 없습니다"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="시작"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            hint="비우면 즉시"
          />
          <Input
            label="종료"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            hint="비우면 무기한"
          />
        </div>

        {inverted && <p className="text-danger text-sm">종료가 시작보다 빠릅니다.</p>}

        {/* 🔴 "코드를 어디에 쓰냐" 는 질문이 실제로 나왔습니다. 쿠폰처럼 읽히기 때문입니다 */}
        <p className="surface-2 text-ink-muted rounded-xl p-3 text-sm">
          이벤트를 열어 두면 <b className="text-ink">뽑기 화면에 들어오는 것만으로</b> 카드팩이 하나
          생깁니다. 사용자가 코드를 입력하는 곳은 없습니다.
          <br />
          같은 사람은 <b className="text-ink">이 코드로 한 번만</b> 받습니다 — 이미 받은 사람에게 또
          주려면 <b className="text-ink">새 코드로 새 이벤트</b>를 여세요.
        </p>
      </div>
    </Modal>
  );
}
