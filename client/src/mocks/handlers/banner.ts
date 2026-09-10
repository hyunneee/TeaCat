import { mock } from '../router';

/**
 * 홈 상단 배너.
 * 실제로는 운영자가 등록한 광고·이벤트를 내려줍니다.
 */
mock('GET', '/banners', () => [
  {
    id: 'b-1',
    label: 'EVENT',
    title: '고척돔에서 캣머니 찾기',
    subtitle: '전 좌석에 시크릿 포토카드가 숨어 있어요',
    artSeed: 'grape-event',
    imageUrl: null,
    linkType: 'CONCERT',
    linkId: 'c-3',
  },
  {
    id: 'b-2',
    label: '예매 중',
    title: 'PURPLE WAVE 2026',
    subtitle: 'VIOLETTA 단독 콘서트 · 고척스카이돔',
    artSeed: 'purple-wave',
    imageUrl: null,
    linkType: 'CONCERT',
    linkId: 'c-1',
  },
  /* 🔴 개발 확인용 진입로입니다. **운영으로 열기 전에 이 항목을 빼세요.**
     배너는 목업이라 배포본에서도 보입니다(VITE_USE_MOCK 은 켜진 채입니다). */
  {
    id: 'b-draw',
    label: 'EVENT',
    title: '포토카드 뽑기',
    subtitle: '봉지를 뜯어 코치님을 만나보세요',
    artSeed: 'poca-draw',
    imageUrl: null,
    linkType: 'POCA_DRAW',
    linkId: null,
  },
  {
    id: 'b-3',
    label: 'NEW',
    title: '포토카드 마켓 오픈',
    subtitle: '모은 캣머니로 원하는 포카를 교환하세요',
    artSeed: 'poca-market',
    imageUrl: null,
    linkType: 'NFT',
    linkId: null,
  },
  {
    id: 'b-4',
    label: '안내',
    title: '1인 1매 정책 안내',
    subtitle: '얼굴 등록을 마쳐야 입장할 수 있어요',
    artSeed: 'policy',
    imageUrl: null,
    linkType: 'NONE',
    linkId: null,
  },
]);
