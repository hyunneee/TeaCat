import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import type { UserRole } from '@/features/auth';
import { adminKeys, adminUserApi } from '../api/adminUserApi';
import type { AdminUserQuery } from '../model/adminUser.types';

const DEFAULT_SIZE = 20;

/**
 * 회원 목록 (Controller 레이어).
 *
 * 검색어·역할·페이지는 **화면 상태**라 useState 로 둡니다. 목록 자체는
 * 서버 데이터라 TanStack Query 가 주인입니다 (CLAUDE.md 3-4).
 *
 * `keepPreviousData` 로 페이지를 넘길 때 표가 비워지지 않게 합니다 —
 * 관리 화면에서 표가 깜빡이면 지금 몇 페이지인지 놓칩니다.
 */
export function useAdminUsers() {
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [page, setPage] = useState(0);

  const query: AdminUserQuery = useMemo(
    () => ({ keyword, role, page, size: DEFAULT_SIZE }),
    [keyword, role, page],
  );

  const result = useQuery({
    queryKey: adminKeys.userList(query),
    queryFn: () => adminUserApi.list(query),
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  /* 검색어나 역할을 바꾸면 페이지를 0 으로 되돌립니다.
     3페이지를 보다 검색하면 결과가 1페이지뿐이라 빈 화면이 나옵니다. */
  const search = (next: string) => {
    setKeyword(next);
    setPage(0);
  };

  const filterRole = (next: UserRole | null) => {
    setRole(next);
    setPage(0);
  };

  return {
    ...result,
    query,
    keyword,
    role,
    page,
    search,
    filterRole,
    setPage,
  };
}

/** 대시보드 요약 카드 */
export function useAdminUserStats() {
  return useQuery({
    queryKey: adminKeys.userStats(),
    queryFn: adminUserApi.stats,
    staleTime: STALE_TIME.SHORT,
  });
}
