import { useState } from 'react';
import { Button, Input } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { cn } from '@/shared/lib';
import { designNameLength, DESIGN_NAME_MAX } from '../model/adminPocaDesign.model';
import type { AdminPocaTemplate, PocaPoolItem } from '../model/adminPocaDesign.types';

interface Props {
  templates: AdminPocaTemplate[];
  /** 이미 이 풀에 들어간 템플릿 — 다시 넣으면 409 라 아예 못 고르게 합니다 */
  addedTemplateIds: number[];
  /**
   * 공연 제목. 있으면 도안 이름이 `"{템플릿} · {공연}"` 이 되고 100자 제한에 걸릴 수 있습니다.
   * 이벤트 풀은 템플릿 이름 그대로라 넘기지 않습니다.
   */
  performanceTitle?: string;
  isPending: boolean;
  /** 확인 단계는 바깥(페이지)이 맡습니다 — 되돌릴 수 없는 동작이라 한 번 더 묻습니다 */
  onSubmit: (items: PocaPoolItem[], summary: string) => void;
}

/**
 * 템플릿을 고르고 **몇 장 풀지** 적는 화면 조각. 공연 풀과 이벤트 풀이 같이 씁니다.
 *
 * 🔴 수량 입력의 기본값을 비워 둡니다. `1` 같은 기본값을 두면 실수로 한 장만 박히고,
 * 그건 온체인이라 되돌릴 수 없습니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function AdminPocaPoolPicker({
  templates,
  addedTemplateIds,
  performanceTitle,
  isPending,
  onSubmit,
}: Props) {
  /** templateId → 수량 문자열. 키가 있으면 체크된 것입니다 */
  const [picked, setPicked] = useState<Record<number, string>>({});

  const toggle = (templateId: number) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (templateId in next) delete next[templateId];
      else next[templateId] = '';
      return next;
    });

  const setSupply = (templateId: number, value: string) =>
    setPicked((prev) => ({ ...prev, [templateId]: value.replace(/\D/g, '').slice(0, 6) }));

  const items: PocaPoolItem[] = Object.entries(picked)
    .map(([id, supply]) => ({ templateId: Number(id), totalSupply: Number(supply) }))
    .filter((item) => item.totalSupply > 0);

  const total = items.reduce((sum, item) => sum + item.totalSupply, 0);
  const allFilled = Object.keys(picked).length === items.length;

  /* 🔴 이름이 100자를 넘으면 서버가 거절합니다(NFT_049). 확인 모달까지 갔다가 튕기지 않게 미리 봅니다 */
  const tooLong = templates.filter(
    (t) => t.templateId in picked && designNameLength(t.name, performanceTitle) > DESIGN_NAME_MAX,
  );

  const submit = () => {
    const summary = items
      .map((item) => {
        const template = templates.find((t) => t.templateId === item.templateId);
        return `${template?.name ?? item.templateId} ${item.totalSupply}장`;
      })
      .join(' · ');

    onSubmit(items, summary);
  };

  if (templates.length === 0) {
    return (
      <EmptyState
        title="등록된 카드 그림이 없어요"
        description="먼저 '카드 그림 관리' 에서 그림을 올려야 풀에 넣을 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {templates.map((template) => {
          const added = addedTemplateIds.includes(template.templateId);
          const checked = template.templateId in picked;

          return (
            <li key={template.templateId}>
              <div
                className={cn(
                  'border-line flex items-center gap-3 rounded-xl border p-2.5',
                  checked && 'border-accent-600 bg-accent-50',
                  added && 'opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  id={`tpl-${template.templateId}`}
                  checked={checked}
                  disabled={added}
                  onChange={() => toggle(template.templateId)}
                  className="size-4 shrink-0"
                />
                <img src={template.imageUrl} alt="" className="h-14 w-10 rounded object-cover" />

                <label htmlFor={`tpl-${template.templateId}`} className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm font-semibold">
                    {template.name}
                  </span>
                  <span className="text-ink-muted block truncate text-xs">
                    {/* 이미 넣은 카드는 이유를 적어 줍니다 — 비활성화만 하면 왜인지 알 수 없습니다 */}
                    {added ? '이미 넣은 카드' : template.group}
                  </span>
                </label>

                {checked && (
                  <Input
                    value={picked[template.templateId] ?? ''}
                    onChange={(e) => setSupply(template.templateId, e.target.value)}
                    placeholder="수량"
                    inputMode="numeric"
                    className="w-20"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {tooLong.length > 0 && (
        <p className="text-danger text-sm">
          이름이 너무 깁니다 — {tooLong.map((t) => t.name).join(', ')}. 카드 이름이나 공연 제목을
          줄여 주세요(합쳐서 {DESIGN_NAME_MAX}자까지).
        </p>
      )}

      <div className="border-line flex items-center justify-between gap-4 border-t pt-3">
        <p className="text-ink-muted text-sm">
          {items.length > 0 ? (
            <>
              <span className="text-ink font-semibold">{items.length}종</span> · 총{' '}
              <span className="text-ink font-semibold tabular-nums">{total.toLocaleString()}</span>
              장
            </>
          ) : (
            '넣을 카드를 고르고 수량을 적으세요'
          )}
        </p>

        <Button
          variant="dark"
          disabled={items.length === 0 || !allFilled || tooLong.length > 0}
          loading={isPending}
          onClick={submit}
        >
          풀에 넣기
        </Button>
      </div>
    </div>
  );
}
