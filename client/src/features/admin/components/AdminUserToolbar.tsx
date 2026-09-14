import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { Button, Input, Select } from '@/shared/components/ui';
import type { UserRole } from '@/features/auth';
import { ROLE_FILTER_OPTIONS } from '../model/adminUser.model';

/** 검색을 입력마다 보내면 글자 수만큼 요청이 나갑니다 */
const SEARCH_DEBOUNCE_MS = 300;

export interface AdminUserToolbarProps {
  keyword: string;
  role: UserRole | null;
  onSearch: (keyword: string) => void;
  onFilterRole: (role: UserRole | null) => void;
  onCreate: () => void;
}

export function AdminUserToolbar({
  keyword,
  role,
  onSearch,
  onFilterRole,
  onCreate,
}: AdminUserToolbarProps) {
  /* 입력은 즉시 반응해야 하고(글자가 늦게 보이면 고장 같습니다) 요청은 늦게 나가야
     하므로, 화면용 값을 따로 들고 있다가 조용해지면 위로 올립니다. */
  const [draft, setDraft] = useState(keyword);

  useEffect(() => {
    if (draft === keyword) return;

    const timer = setTimeout(() => onSearch(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, keyword, onSearch]);

  return (
    <div className="border-line flex items-center gap-2 border-b p-4">
      <Input
        className="max-w-xs"
        leftIcon={<Search size={16} />}
        placeholder="이메일·이름·닉네임·전화번호"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClear={() => setDraft('')}
        aria-label="회원 검색"
      />

      <Select
        label="역할"
        options={ROLE_FILTER_OPTIONS}
        value={role ?? ''}
        onChange={(next) => onFilterRole(next === '' ? null : (next as UserRole))}
      />

      <div className="flex-1" />

      {/* 이 화면의 주 행동. 거래가 아니라 dark 입니다 */}
      <Button variant="dark" size="sm" leftIcon={<UserPlus size={16} />} onClick={onCreate}>
        회원 생성
      </Button>
    </div>
  );
}

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  /** 세는 단위. 회원 표는 '명', 문의 표는 '건' 처럼 화면마다 다릅니다 */
  unit?: string;
  onChange: (page: number) => void;
}

export function AdminPagination({
  page,
  totalPages,
  totalElements,
  unit = '명',
  onChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className="border-line text-ink-muted border-t px-4 py-3 text-xs">
        전체 {totalElements}
        {unit}
      </p>
    );
  }

  return (
    <div className="border-line flex items-center justify-between border-t px-4 py-3">
      <p className="text-ink-muted text-xs">
        전체 {totalElements}
        {unit}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ChevronLeft size={16} />}
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          이전
        </Button>

        <span className="text-ink-muted text-xs tabular-nums">
          {page + 1} / {totalPages}
        </span>

        <Button
          variant="ghost"
          size="sm"
          rightIcon={<ChevronRight size={16} />}
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
