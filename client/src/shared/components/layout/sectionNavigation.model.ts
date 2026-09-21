import { ROUTES } from '@/shared/constants';

export function sectionNavigation(path: string) {
  if (path.startsWith(ROUTES.MY_TICKETS) || path === ROUTES.MY_RESALE) {
    return {
      label: '내 티켓 메뉴',
      items: [
        { to: ROUTES.MY_TICKETS, label: '예매 내역', active: path.startsWith(ROUTES.MY_TICKETS) },
        { to: ROUTES.MY_RESALE, label: '취소표 대기 내역', active: path === ROUTES.MY_RESALE },
      ],
    };
  }
  if (
    [ROUTES.MY_AUCTIONS, ROUTES.MY_BIDS, ROUTES.MY_NFT_TRADES, ROUTES.MY_NFT_SALES].some(
      (route) => route === path,
    )
  ) {
    return {
      label: '내 포카 메뉴',
      items: [
        { to: ROUTES.MY_NFTS, label: '도감', active: false },
        { to: ROUTES.MY_AUCTIONS, label: '내 경매', active: path === ROUTES.MY_AUCTIONS },
        { to: ROUTES.MY_BIDS, label: '내 입찰', active: path === ROUTES.MY_BIDS },
        { to: ROUTES.MY_NFT_TRADES, label: '거래 내역', active: path.startsWith(ROUTES.MY_NFTS) },
      ],
    };
  }
  if (path.startsWith(ROUTES.MY_INQUIRIES))
    return {
      label: '고객 지원 메뉴',
      items: [{ to: ROUTES.MY_INQUIRIES, label: '내 문의', active: true }],
    };
  if (/^\/concerts\/[^/]+$/.test(path))
    return {
      label: '공연 메뉴',
      items: [
        { to: ROUTES.CONCERTS, label: '공연', active: true },
        { to: ROUTES.MY_TICKETS, label: '예매 내역', active: false },
      ],
    };
  return null;
}
