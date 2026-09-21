import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { isExternalLink, openExternalLink } from '@/shared/lib';

interface Props {
  /** 등록자가 적어 둔 바로가기 주소. 서비스 내 경로이거나 http(s) 주소입니다 */
  url: string;
  /** 서비스 내 경로일 때 이동을 맡깁니다 — 이 컴포넌트는 라우터를 모릅니다 */
  onNavigate: (path: string) => void;
}

/**
 * 공연 상세의 **바로가기** 버튼.
 *
 * 등록자가 주소를 적어 둔 공연에만 뜹니다. 공식 사이트·아티스트 채널처럼 우리가 담지 않는
 * 정보로 보내는 자리입니다.
 *
 * 🔴 **바깥으로 나가는 링크는 그렇게 보여야 합니다.** 같은 모양으로 두면 누른 사람은
 *    앱 안에서 다음 화면이 뜰 거라고 기대하는데 새 탭이 열립니다. 그래서 외부일 때만
 *    아이콘을 바꾸고 화면 읽기(aria-label)에도 적습니다.
 *
 * ⚠️ 초록(primary)을 쓰지 않습니다. 이 화면에서 지금 눌러야 할 것은 **예매**이고,
 *    초록이 둘이면 둘 다 안 눌립니다 (CLAUDE.md 4-6).
 */
export function ConcertLinkButton({ url, onNavigate }: Props) {
  const external = isExternalLink(url);

  return (
    <Button
      variant="outline"
      size="md"
      rightIcon={external ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
      aria-label={external ? '바로가기 (새 탭으로 열림)' : '바로가기'}
      className="shrink-0"
      onClick={() => (external ? openExternalLink(url) : onNavigate(url))}
    >
      바로가기
    </Button>
  );
}
