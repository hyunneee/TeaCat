import { ImagePlus, TriangleAlert } from 'lucide-react';
import {
  AdminPocaPoolPicker,
  type AdminPocaTemplate,
  type PocaPoolSelection,
} from '@/features/admin';
import { EmptyState } from '@/shared/components/common';
import { Button, Skeleton } from '@/shared/components/ui';

interface Props {
  templates: AdminPocaTemplate[] | undefined;
  selection: PocaPoolSelection;
  performanceTitle: string;
  suggestTotal?: number;
  loading: boolean;
  error: boolean;
  disabled: boolean;
  showErrors: boolean;
  onSelectionChange: (selection: PocaPoolSelection) => void;
  onAddTemplate: () => void;
  onRetry: () => void;
}

/**
 * 공연 등록 전에 카드 그림과 수량을 고르는 순수 화면 조각.
 *
 * 아직 공연 ID가 없으므로 여기서는 서버에 넣지 않고 선택값만 부모 폼에 돌려줍니다.
 * 새 그림 등록은 템플릿만 즉시 만들고, 공연 풀 도안은 공연 생성 뒤 한 번에 만듭니다.
 */
export function ConcertPhotocardPoolEditor({
  templates,
  selection,
  performanceTitle,
  suggestTotal,
  loading,
  error,
  disabled,
  showErrors,
  onSelectionChange,
  onAddTemplate,
  onRetry,
}: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">포토카드 뽑기 풀</p>
          <p className="text-subtle text-xs leading-relaxed">
            기존 카드 그림을 고르거나 새로 등록하세요. 선택한 수량은 공연 등록 후 온체인 도안으로
            만들어집니다.
          </p>
        </div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          leftIcon={<ImagePlus size={15} />}
          disabled={disabled}
          onClick={onAddTemplate}
        >
          새 카드 그림
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-36" />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="카드 그림을 불러오지 못했어요"
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          }
        />
      ) : (
        <AdminPocaPoolPicker
          templates={templates ?? []}
          addedTemplateIds={[]}
          performanceTitle={performanceTitle}
          suggestTotal={suggestTotal}
          disabled={disabled}
          showErrors={showErrors}
          selection={{ value: selection, onChange: onSelectionChange }}
          emptyDescription="위의 '새 카드 그림'에서 그림을 등록하거나, 다른 관리자가 등록한 그림을 선택하세요."
        />
      )}
    </section>
  );
}
