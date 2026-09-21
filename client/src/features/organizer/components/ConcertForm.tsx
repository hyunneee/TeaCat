import { ImagePlus, Link2, Lock, Plus, RefreshCw, X } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Button, IconButton, Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import type { AreaPricingRow } from '../model/areaPricing';
import {
  ACCEPTED_IMAGE_TYPES,
  LINK_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type ConcertCreateErrors,
  type ConcertCreateForm as FormValues,
  type PhotocardDesignForm,
  type StadiumLayoutSummary,
  type StadiumSummary,
} from '../model/organizer.types';
import { AreaPricingEditor } from './AreaPricingEditor';
import { PhotocardDesignEditor } from './PhotocardDesignEditor';

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
  /**
   * 무대 형식 선택 (등록 화면). 공연장을 고르면 그 공연장의 형식 목록이 뜹니다.
   *
   * 수정 화면은 넘기지 않습니다 — 형식을 바꾸면 구역 자체가 달라져서 저장해 둔
   * 등급·가격과 생성한 회차 좌석이 전부 어긋납니다. 서버도 티켓팅 이후에는 거절합니다
   * (PERFORMANCE_LAYOUT_003).
   */
  layouts?: {
    /** 고를 수 있는 형식 — `ACTIVE` 만 담아 넘깁니다 */
    options: StadiumLayoutSummary[];
    loading: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
  };
  /**
   * 구역별 등급·가격 (등록 화면). 무대 형식을 고르면 그 형식의 구역이 줄로 뜹니다.
   * 수정 화면은 구역 설정을 별도 섹션에서 저장하므로 넘기지 않습니다.
   */
  areaPricing?: {
    rows: AreaPricingRow[];
    errors: (string | undefined)[];
    loading: boolean;
    error: boolean;
    onChange: (index: number, patch: Partial<AreaPricingRow>) => void;
  };
  /**
   * 공연과 함께 등록할 포토카드 도안. **등록 화면에서만** 넘깁니다 —
   * 도안 API 가 `performanceId` 를 요구해서 공연이 만들어진 뒤에야 보낼 수 있고,
   * 수정 화면은 이미 있는 공연이라 도안 관리가 따로 필요합니다.
   */
  designs?: PhotocardDesignForm[];
  onDesignsChange?: (designs: PhotocardDesignForm[]) => void;
  /** 도안 줄의 에러를 보여줄지. 제출을 누른 뒤부터 켭니다 */
  showDesignErrors?: boolean;
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
  layouts,
  areaPricing,
  designs,
  onDesignsChange,
  showDesignErrors = false,
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

      {/* 무대 형식 — 공연장 바로 아래. 같은 공연장도 무대를 U형·O형처럼 바꾸면 구역이 다르게 나뉘어서,
          형식을 먼저 골라야 어떤 구역을 팔지가 정해집니다. 등록에서만 고릅니다 (아래 layouts 주석 참고) */}
      {layouts && (
        <Field
          label="무대 형식"
          required
          error={errors.stadiumLayoutId}
          hint="같은 공연장도 무대 형식에 따라 구역이 다르게 나뉘어요. 등록 후에는 바꿀 수 없습니다."
        >
          {form.stadiumId && layouts.onRefresh && (
            <div className="mb-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                loading={layouts.refreshing}
                onClick={layouts.onRefresh}
              >
                목록 새로고침
              </Button>
            </div>
          )}
          {!form.stadiumId ? (
            <p className="text-subtle surface-2 rounded-xl px-3 py-3 text-sm">
              공연장을 먼저 선택하면 무대 형식이 나타나요.
            </p>
          ) : layouts.loading ? (
            <p className="text-subtle surface-2 rounded-xl px-3 py-3 text-sm">무대 형식을 불러오는 중…</p>
          ) : layouts.options.length === 0 ? (
            <p className="text-danger surface-2 rounded-xl px-3 py-3 text-sm">
              이 공연장에 쓸 수 있는 무대 형식이 없어요. 공연장 관리에서 형식을 활성 상태로 만들어 주세요.
            </p>
          ) : (
            <select
              value={form.stadiumLayoutId}
              onChange={(e) => onChange({ stadiumLayoutId: e.target.value })}
              onBlur={() => onBlur('stadiumLayoutId')}
              className={cn(
                'surface-2 h-11 w-full rounded-xl px-3 text-[0.9375rem] outline-none',
                'focus:ring-brand-500 focus:ring-2 disabled:opacity-50',
                errors.stadiumLayoutId && 'ring-danger ring-2',
              )}
            >
              <option value="">무대 형식을 선택하세요</option>
              {layouts.options.map((layout) => (
                <option key={layout.layoutId} value={String(layout.layoutId)}>
                  {layout.name}
                  {layout.isDefault && ' (기본)'} · 구역 {layout.areaCount}개 · 수용{' '}
                  {layout.capacity.toLocaleString()}명
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {/* 구역 등급·가격 — 고른 형식의 구역이 줄로 뜨고, 팔 구역을 켜서 등급·가격을 적습니다.
          예매 화면이 보여주는 가격의 출처입니다. */}
      {areaPricing && (
        <Field
          label="구역 등급·가격"
          hint="판매할 구역을 켜고 등급·가격을 적어요. 좌석 지정은 등록된 좌석 수만큼 팔고, 스탠딩은 받을 인원을 정합니다. 끈 구역은 이 공연에서 팔지 않아요."
          error={areaPricing.errors.some(Boolean) ? '구역 설정을 확인해 주세요.' : undefined}
        >
          {!form.stadiumLayoutId ? (
            <p className="text-subtle surface-2 rounded-xl px-3 py-3 text-sm">
              무대 형식을 먼저 선택하면 구역이 나타나요.
            </p>
          ) : areaPricing.loading ? (
            <p className="text-subtle surface-2 rounded-xl px-3 py-3 text-sm">구역을 불러오는 중…</p>
          ) : areaPricing.error ? (
            <p className="text-danger surface-2 rounded-xl px-3 py-3 text-sm">구역 목록을 불러오지 못했어요.</p>
          ) : (
            <AreaPricingEditor
              rows={areaPricing.rows}
              errors={areaPricing.errors}
              onChange={areaPricing.onChange}
            />
          )}
        </Field>
      )}

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

      {designs && onDesignsChange && (
        <PhotocardDesignEditor
          designs={designs}
          showErrors={showDesignErrors}
          disabled={submitting}
          onChange={onDesignsChange}
        />
      )}

      {/* 바로가기 — 등록 옵션 맨 아래. 대부분의 공연에는 없으므로 **접어 둡니다.**
          칸을 늘 펼쳐 두면 "채워야 하는 것" 으로 읽혀서, 안 쓰는 사람이 매번 지나쳐야 합니다
          (포토카드 도안에서 줄을 미리 열지 않는 것과 같은 판단입니다). */}
      <LinkField
        value={form.linkUrl}
        error={errors.linkUrl}
        disabled={submitting}
        onChange={(linkUrl) => onChange({ linkUrl })}
        onBlur={() => onBlur('linkUrl')}
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

/**
 * 바로가기 추가하기.
 *
 * 접힌 상태에서는 버튼 하나만 있고, 누르면 주소 칸이 열립니다. 주소가 이미 있는 공연
 * (수정 화면)은 **열린 채로** 시작합니다 — 접어 두면 값이 있는데 안 보여서
 * "안 들어갔나?" 가 됩니다.
 *
 * 🔴 접을 때 값을 **비웁니다.** 비우지 않으면 화면에서 사라진 주소가 그대로 저장돼,
 *    "뺐는데 상세에 버튼이 그대로" 가 됩니다. 수정 화면에서는 이 빈 값이 서버로 가서
 *    바로가기를 뗍니다 (`toConcertUpdateRequest` 주석).
 */
function LinkField({
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [opened, setOpened] = useState(false);
  /* 값이 있으면 무조건 열어 둡니다 — 수정 화면은 값이 늦게 도착할 수 있어
     마운트 시점의 상태만으로는 판단할 수 없습니다 */
  const open = opened || value.length > 0;

  const close = () => {
    setOpened(false);
    onChange('');
    onBlur();
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          leftIcon={<Link2 size={16} />}
          disabled={disabled}
          onClick={() => setOpened(true)}
        >
          바로가기 추가하기
        </Button>
        <span className="text-subtle text-xs">
          공식 사이트·아티스트 채널처럼 우리가 담지 않는 곳으로 보내는 버튼을 공연 상세에 답니다.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">바로가기</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={<X size={14} />}
          disabled={disabled}
          onClick={close}
        >
          빼기
        </Button>
      </div>

      <Input
        placeholder="https://example.com 또는 /nft/draw"
        value={value}
        error={error}
        disabled={disabled}
        maxLength={LINK_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        hint="http(s) 로 시작하는 외부 주소는 새 탭으로, '/' 로 시작하는 서비스 내 경로는 같은 탭에서 열려요."
      />
    </div>
  );
}

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
