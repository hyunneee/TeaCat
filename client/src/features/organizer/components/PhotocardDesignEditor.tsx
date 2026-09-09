import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { Button, IconButton, Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import {
  ACCEPTED_IMAGE_TYPES,
  DESIGN_NAME_MAX_LENGTH,
  EMPTY_PHOTOCARD_DESIGN,
  validatePhotocardDesign,
  type PhotocardDesignForm,
} from '../model/organizer.types';

interface Props {
  designs: PhotocardDesignForm[];
  /** 제출을 눌렀거나 손댄 뒤부터 에러를 보여줍니다 */
  showErrors: boolean;
  disabled: boolean;
  onChange: (designs: PhotocardDesignForm[]) => void;
}

/**
 * 공연과 함께 등록할 포토카드 도안 편집기 (순수 View).
 *
 * <b>도안은 공연이 만들어진 뒤에야 서버로 갑니다</b> — 도안 API 가 `performanceId` 를 필수로
 * 받기 때문입니다. 여기서는 모아만 두고, 공연 등록이 성공한 직후 순서대로 보냅니다.
 *
 * 회차 편집과 달리 줄을 미리 열어두지 않습니다. 포토카드는 없어도 되는 공연이 정상이라,
 * 빈 줄이 먼저 보이면 "채워야 하는 것" 으로 읽힙니다.
 */
export function PhotocardDesignEditor({ designs, showErrors, disabled, onChange }: Props) {
  const patch = (index: number, values: Partial<PhotocardDesignForm>) => {
    onChange(designs.map((design, i) => (i === index ? { ...design, ...values } : design)));
  };

  const add = () => onChange([...designs, { ...EMPTY_PHOTOCARD_DESIGN }]);
  const remove = (index: number) => onChange(designs.filter((_, i) => i !== index));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">포토카드 도안</span>
        <span className="text-subtle text-xs leading-relaxed">
          공연을 등록한 뒤 도안이 차례로 올라갑니다. 비워 두면 도안 없이 공연만 등록해요.
        </span>
      </div>

      {designs.map((design, index) => {
        const errors = showErrors ? validatePhotocardDesign(design) : {};

        return (
          <div key={index} className="surface-2 flex flex-col gap-3 rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-muted text-xs font-semibold">도안 {index + 1}</span>
              <IconButton
                label={`도안 ${index + 1} 삭제`}
                size="sm"
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>

            <Input
              label="도안 이름"
              placeholder="예: 단독 콘서트 한정 포토카드 A"
              maxLength={DESIGN_NAME_MAX_LENGTH}
              value={design.name}
              error={errors.name}
              disabled={disabled}
              onChange={(e) => patch(index, { name: e.target.value })}
            />

            <Input
              label="한정 수량"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="예: 100"
              value={design.totalSupply}
              error={errors.totalSupply}
              hint="발급이 시작되면 바꿀 수 없어요."
              disabled={disabled}
              onChange={(e) => patch(index, { totalSupply: e.target.value })}
            />

            <Input
              label="설명 (선택)"
              placeholder="예: 2026 단독 콘서트 기념"
              value={design.description}
              error={errors.description}
              disabled={disabled}
              onChange={(e) => patch(index, { description: e.target.value })}
            />

            <DesignImagePicker
              file={design.image}
              error={errors.image}
              disabled={disabled}
              onChange={(e) => patch(index, { image: e.target.files?.[0] ?? null })}
            />
          </div>
        );
      })}

      <Button
        type="button"
        variant="soft"
        size="md"
        leftIcon={<Plus size={16} />}
        disabled={disabled}
        onClick={add}
      >
        포토카드 도안 추가
      </Button>
    </section>
  );
}

function DesignImagePicker({
  file,
  error,
  disabled,
  onChange,
}: {
  file: File | null;
  error?: string;
  disabled: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        도안 이미지<span className="text-danger ml-0.5">*</span>
      </span>
      <span
        className={cn(
          'surface flex h-11 items-center gap-2 rounded-xl px-3 text-[0.9375rem]',
          error && 'ring-danger ring-2',
          disabled && 'opacity-60',
        )}
      >
        <ImagePlus size={18} className="text-ink-muted shrink-0" />
        <span className={cn('min-w-0 flex-1 truncate', !file && 'text-subtle')}>
          {file ? file.name : '파일 선택'}
        </span>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
      </span>
      {error ? (
        <span className="text-danger text-xs">{error}</span>
      ) : (
        <span className="text-subtle text-xs">jpg · png · webp · gif, 5MB 이하</span>
      )}
    </label>
  );
}
