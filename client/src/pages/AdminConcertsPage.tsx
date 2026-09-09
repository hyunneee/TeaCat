import { useNavigate } from 'react-router-dom';
import { CalendarDays, Eye, EyeOff, Music, Pencil, Plus, Search } from 'lucide-react';
import { Badge, Button, Card, Input, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { CONCERT_STATUS_LABEL, type ConcertSummary } from '@/features/concert';
import { useManagedConcerts } from '@/features/organizer';

/**
 * 공연 관리 목록 (어드민 콘솔).
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 *
 * 🔴 보이는 범위가 역할마다 다릅니다 — ADMIN 은 전체, 공연 주최자(PERFORMANCE)는 본인 것만.
 *    판단은 `useManagedConcerts` 안에 있고 서버 권한과 같습니다.
 */
export function AdminConcertsPage() {
  const navigate = useNavigate();
  const { data: concerts, isPending, keyword, setKeyword, searchable } = useManagedConcerts();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-lg font-bold">공연 관리</h1>
          <p className="text-ink-muted text-sm">
            {searchable
              ? '등록된 모든 공연입니다. 비공개 공연도 여기서 다시 찾을 수 있어요.'
              : '내가 등록한 공연입니다. 비공개 공연도 여기서 다시 찾을 수 있어요.'}
          </p>
        </div>
        <Button
          variant="dark"
          leftIcon={<Plus size={16} />}
          onClick={() => navigate(ROUTES.ADMIN_CONCERT_CREATE)}
        >
          공연 등록
        </Button>
      </div>

      {/* 검색은 서버가 하고 ADMIN 목록에만 있습니다 — 내 공연 목록은 짧아 서버 검색이 없습니다 */}
      {searchable && (
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onClear={() => setKeyword('')}
          placeholder="공연명으로 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />
      )}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !concerts || concerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Music}
            title={keyword ? '검색 결과가 없어요' : '등록된 공연이 없어요'}
            description={
              keyword ? '다른 공연명으로 찾아보세요.' : '공연 등록으로 첫 공연을 만들어 보세요.'
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {concerts.map((concert) => (
            <li key={concert.concertId}>
              <ConcertRow
                concert={concert}
                onEdit={() => navigate(ROUTES.ADMIN_CONCERT_EDIT(String(concert.concertId)))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConcertRow({ concert, onEdit }: { concert: ConcertSummary; onEdit: () => void }) {
  return (
    <Card className="flex items-center gap-4">
      {/* 포스터가 없는 공연도 있습니다. 빈 칸을 두면 줄마다 높이가 달라집니다 */}
      {concert.posterUrl ? (
        <img
          src={concert.posterUrl}
          alt=""
          className="bg-surface-2 h-20 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="bg-surface-2 text-ink-subtle flex h-20 w-14 shrink-0 items-center justify-center rounded-lg">
          <Music size={18} aria-hidden />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-ink truncate font-semibold">{concert.title}</p>
          {/* 비공개는 "지금 손님에게 안 보인다" 는 뜻이라 제목 옆이 맞습니다 */}
          {concert.hidden && (
            <Badge tone="quiet" size="sm">
              <EyeOff size={11} aria-hidden /> 비공개
            </Badge>
          )}
        </div>
        <p className="text-ink-muted mt-0.5 truncate text-sm">{concert.stadiumName}</p>
        <p className="text-ink-subtle mt-1 flex items-center gap-1.5 text-xs">
          <CalendarDays size={12} aria-hidden />
          티켓 오픈 {formatDateTime(concert.ticketingStartAt)}
        </p>
      </div>

      <Badge tone={concert.status === 'UPCOMING' ? 'accent' : 'quiet'}>
        {CONCERT_STATUS_LABEL[concert.status]}
      </Badge>

      <Button variant="soft" size="md" leftIcon={<Pencil size={15} />} onClick={onEdit}>
        관리
      </Button>

      {/* 공개 상세는 비공개 공연이 404 라 링크를 걸지 않습니다 */}
      {!concert.hidden && (
        <Button
          variant="ghost"
          size="md"
          leftIcon={<Eye size={15} />}
          onClick={() => window.open(ROUTES.CONCERT_DETAIL(String(concert.concertId)), '_blank')}
        >
          보기
        </Button>
      )}
    </Card>
  );
}
