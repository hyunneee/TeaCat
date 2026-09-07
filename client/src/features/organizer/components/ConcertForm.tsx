import { ImagePlus, Lock, Plus, X } from 'lucide-react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Button, IconButton, Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import {
  ACCEPTED_IMAGE_TYPES,
  TITLE_MAX_LENGTH,
  type ConcertCreateErrors,
  type ConcertCreateForm as FormValues,
  type StadiumSummary,
} from '../model/organizer.types';

interface Props {
  form: FormValues;
  errors: ConcertCreateErrors;
  stadiums: StadiumSummary[];
  submitting: boolean;
  disabled: boolean;
  /** 버튼 글자 — 등록은 "등록하기", 수정은 "저장하기" */
  submitLabel: string;
  /**
   * 수정 화면에서 티켓팅이 이미 시작된 경우. 공연장·티켓팅 시각·노출 시작일을 잠그고 이유를 보여줍니다.
   * 서버도 같은 규칙으로 거절하므로(PERFORMANCE_003) 여기서 잠그는 건 헛걸음을 막는 안내입니다.
   */
  lockedReason?: string;
  /** 수정 화면이면 이미지 칸의 안내가 "바꾸려면 고르세요" 로 달라집니다 */
  editing?: boolean;
  onChange: (patch: Partial<FormValues>) => void;
  onBlur: (name: keyof FormValues) => void;
  onSubmit: () => void;
}

/**
 * 공연 등록·수정 폼 (순수 View — 값·에러·공연장 목록을 props 로 받아 그리기만 합니다).
 *
 * 공연장은 네이티브 `<select>` 입니다. 공용 `Select` 는 정렬처럼 옵션이 서넛일 때 쓰는 것이고,
 * 폼 입력·긴 목록에는 네이티브를 쓰라고 그 컴포넌트 주석에 적혀 있습니다.
 *
 * 이미지는 파일 선택기입니다. 원본이 서버로 가는 게 맞습니다 — 얼굴이 아니라 포스터입니다.
 */
export function ConcertForm({
  form,
  errors,
  stadiums,
  submitting,
  disabled,
  submitLabel,
  lockedReason,
  editing = false,
  onChange,
  onBlur,
  onSubmit,
}: Props) {
  const locked = !!lockedReason;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const pickFile = (name: 'poster' | 'detailImage') => (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ [name]: e.target.files?.[0] ?? null });
    onBlur(name);
  };

  /* 회차 줄 편집 — 배열을 통째로 바꿔 넘깁니다 (부분 갱신은 부모의 setForm 이 합칩니다) */
  const setDate = (index: number, value: string) => {
    const next = [...form.performanceDates];
    next[index] = value;
    onChange({ performanceDates: next });
  };
  const addDate = () => onChange({ performanceDates: [...form.performanceDates, ''] });
  const removeDate = (index: number) => {
    onChange({ performanceDates: form.performanceDates.filter((_, i) => i !== index) });
    onBlur('performanceDates');
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4">
      <p className="text-subtle text-xs">
        <span className="text-danger">*</span> 표시는 필수 항목입니다.
      </p>

      {locked && (
        <div className="surface-2 flex items-start gap-2.5 rounded-2xl p-3.5 text-xs leading-relaxed">
          <Lock size={15} className="text-ink-muted mt-0.5 shrink-0" />
          <p className="text-muted">{lockedReason}</p>
        </div>
      )}

      <Input
        label="공연 제목"
        showRequirement
        required
        value={form.title}
        maxLength={TITLE_MAX_LENGTH}
        placeholder="예: 티캣 단독 콘서트 2026"
        error={errors.title ?? null}
        onChange={(e) => onChange({ title: e.target.value })}
        onBlur={() => onBlur('title')}
      />

      <Field label="공연장" required error={errors.stadiumId}>
        <select
          value={form.stadiumId}
          disabled={locked}
          onChange={(e) => onChange({ stadiumId: e.target.value })}
          onBlur={() => onBlur('stadiumId')}
          className={cn(
            'surface-2 h-11 w-full rounded-xl px-3 text-[0.9375rem] outline-none',
            'focus:ring-brand-500 focus:ring-2 disabled:opacity-50',
            errors.stadiumId && 'ring-danger ring-2',
          )}
        >
          <option value="">공연장을 선택하세요</option>
          {stadiums.map((stadium) => (
            <option key={stadium.stadiumId} value={String(stadium.stadiumId)}>
              {stadium.name} · {stadium.address}
            </option>
          ))}
        </select>
      </Field>

      <Input
        label="티켓팅 오픈 시각"
        showRequirement
        required
        type="datetime-local"
        value={form.ticketingStartAt}
        disabled={locked}
        error={errors.ticketingStartAt ?? null}
        onChange={(e) => onChange({ ticketingStartAt: e.target.value })}
        onBlur={() => onBlur('ticketingStartAt')}
      />

      <Input
        label="목록 노출 시작일"
        showRequirement
        required
        type="date"
        value={form.visibleFrom}
        disabled={locked}
        hint="이 날부터 공연 목록에 보입니다. 티켓팅 오픈일보다 늦을 수 없어요."
        error={errors.visibleFrom ?? null}
        onChange={(e) => onChange({ visibleFrom: e.target.value })}
        onBlur={() => onBlur('visibleFrom')}
      />

      {/* 회차 — 등록에서만. 수정에서 회차를 바꾸는 건 회차 API 의 일이라 이 폼에 없습니다.
          번호는 서버가 일시 순으로 붙이므로 여기서는 입력 순서만 보여줍니다. */}
      {!editing && (
        <Field
          label="회차 공연 일시"
          required
          hint="회차 번호는 빠른 일시부터 1회차로 자동으로 붙어요. 일시는 티켓팅 오픈 이후여야 합니다."
          error={errors.performanceDates}
        >
          <div className="flex flex-col gap-2">
            {form.performanceDates.map((date, index) => {
              const itemError = errors.performanceDateItems?.[index];
              return (
                <div key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      type="datetime-local"
                      aria-label={`${index + 1}번째 회차 공연 일시`}
                      value={date}
                      error={itemError ?? null}
                      onChange={(e) => setDate(index, e.target.value)}
                      onBlur={() => onBlur('performanceDates')}
                    />
                  </div>
                  {/* 한 줄만 남았을 때는 지우지 못하게 — 회차 없는 공연은 예매할 게 없습니다 */}
                  {form.performanceDates.length > 1 && (
                    <IconButton
                      label={`${index + 1}번째 회차 삭제`}
                      size="md"
                      className="mt-0.5"
                      onClick={() => removeDate(index)}
                    >
                      <X size={18} />
                    </IconButton>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="soft"
              size="md"
              leftIcon={<Plus size={16} />}
              onClick={addDate}
            >
              회차 추가
            </Button>
          </div>
        </Field>
      )}

      <FilePicker
        label="포스터 이미지"
        hint="jpg · png · webp · gif, 5MB 이하. 목록과 상세 상단에 보입니다."
        placeholder={editing ? '바꾸려면 파일을 고르세요 (비우면 그대로)' : '파일 선택 (선택 사항)'}
        file={form.poster}
        error={errors.poster}
        onChange={pickFile('poster')}
      />

      <FilePicker
        label="상세 페이지 이미지"
        hint="jpg · png · webp · gif, 20MB 이하. 세로로 긴 한 장을 권장합니다."
        placeholder={editing ? '바꾸려면 파일을 고르세요 (비우면 그대로)' : '파일 선택 (선택 사항)'}
        file={form.detailImage}
        error={errors.detailImage}
        onChange={pickFile('detailImage')}
      />

      <Button
        type="submit"
        variant="dark"
        size="lg"
        fullWidth
        className="mt-2"
        loading={submitting}
        disabled={disabled}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

/* ── 폼 보조 요소 ─────────────────────────────────────────── */

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-danger text-xs">{error}</span>
      ) : hint ? (
        <span className="text-subtle text-xs">{hint}</span>
      ) : null}
    </label>
  );
}

function FilePicker({
  label,
  hint,
  placeholder,
  file,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  file: File | null;
  error?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <span
        className={cn(
          'surface-2 flex h-11 items-center gap-2 rounded-xl px-3 text-[0.9375rem]',
          error && 'ring-danger ring-2',
        )}
      >
        <ImagePlus size={18} className="text-ink-muted shrink-0" />
        <span className={cn('min-w-0 flex-1 truncate', !file && 'text-subtle')}>
          {file ? file.name : placeholder}
        </span>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={onChange}
          className="sr-only"
        />
      </span>
    </Field>
  );
}
