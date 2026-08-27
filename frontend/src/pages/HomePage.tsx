import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Coins, Music, Pickaxe, ScanFace, Sparkles, User } from 'lucide-react';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CatMascot,
  Logo,
  PosterImage,
  SectionTitle,
  Skeleton,
  SkeletonList,
} from '@/shared/components/ui';
import { Stagger } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import { BannerCarousel, useBanners, type Banner } from '@/features/banner';
import { useConcerts } from '@/features/concert';
import { useTokenBalance } from '@/features/nft';

/** 카테고리 바로가기. 새 진입점이 생기면 여기에 한 줄 추가하세요. */
const SHORTCUTS = [
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '포토카드', icon: Sparkles },
  { to: ROUTES.TOKEN, label: '토큰 채굴', icon: Pickaxe },
  { to: ROUTES.MY, label: '마이페이지', icon: User },
] as const;

/**
 * 홈.
 *
 * ── 흑백 경계 구조 ────────────────────────────────────────
 * 상단바와 배너 위쪽 90% 는 검정, 배너 아래 10% 부터는 흰 배경입니다.
 * 배너가 검정에서 흰 영역으로 걸쳐 내려오면서 떠 있는 느낌을 만듭니다.
 *
 *   ┌───────────────┐
 *   │ ███ 검정 ████ │  상단바 (로고 · 포도알)
 *   │  ┌─────────┐  │
 *   │  │  배너   │  │  4:3
 *   │  ├ ─ ─ ─ ─ ┤  │  ← 경계 (배너 높이의 90%)
 *   │  └─────────┘  │
 *   │ ░░░ 하양 ░░░░ │  카테고리 · 목록
 *   └───────────────┘
 *
 * 경계 높이는 JS 로 재지 않고 `--banner-height`(styles/index.css) 로 계산합니다.
 * 배너 비율을 바꾸면 그 변수도 함께 고쳐야 합니다.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { data: concerts, isPending } = useConcerts();
  const { data: banners, isPending: bannersPending } = useBanners();
  const { data: token } = useTokenBalance();

  const open = concerts?.filter((c) => !c.upcoming).slice(0, 3) ?? [];

  /** 배너를 눌렀을 때 어디로 갈지는 배너 데이터가 알려줍니다 (linkType). */
  const openBanner = (banner: Banner) => {
    if (banner.linkType === 'CONCERT' && banner.linkId) {
      navigate(ROUTES.CONCERT_DETAIL(banner.linkId));
    } else if (banner.linkType === 'NFT') {
      navigate(ROUTES.NFT_MARKET);
    } else if (banner.linkType === 'TOKEN') {
      navigate(ROUTES.TOKEN);
    }
  };

  return (
    <div className="relative">
      {/* 검정 배경판 — 상단바 + 배너 위쪽 90% 를 덮습니다 */}
      <div
        aria-hidden
        className="surface-ink absolute inset-x-0 top-0"
        style={{
          height:
            'calc(env(safe-area-inset-top) + var(--spacing-header) + 0.75rem + var(--banner-height) * 0.9)',
        }}
      />

      {/* ── 최상단 줄 (검정 위) ── */}
      <header className="pt-safe relative">
        <div className="flex h-(--spacing-header) items-center gap-2 px-4">
          <div className="min-w-0 flex-1 text-white">
            <Logo size={28} invert />
          </div>

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate(ROUTES.TOKEN)}
              className="flex items-center gap-1.5 rounded-lg border border-white/25 px-2.5 py-1.5 text-white transition-colors hover:bg-white/10"
            >
              <Coins size={14} />
              <AnimatedNumber value={token?.balance ?? 0} className="text-xs font-bold" />
            </button>
          )}
        </div>
      </header>

      {/* ── 배너 (검정 → 하양 경계에 걸침) ── */}
      <div className="relative px-4 pt-3">
        {bannersPending ? (
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        ) : (
          banners && <BannerCarousel banners={banners} onSelect={openBanner} />
        )}
      </div>

      {/* ── 흰 배경 영역 ── */}
      <div className="relative space-y-7 px-4 pt-6">
        {/* 카테고리 — 원형 버튼 */}
        <Stagger as="ul" className="grid grid-cols-4 gap-2">
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <Stagger.Item as="li" key={to}>
              <motion.button
                type="button"
                onClick={() => navigate(to)}
                whileTap={{ scale: 0.92 }}
                className="flex w-full flex-col items-center gap-2"
              >
                <span className="border-line surface flex size-14 items-center justify-center rounded-full border">
                  <Icon size={22} className="text-brand-800" strokeWidth={1.7} />
                </span>
                <span className="text-xs font-semibold">{label}</span>
              </motion.button>
            </Stagger.Item>
          ))}
        </Stagger>

        {isLoggedIn && user && !user.faceRegistered && (
          <Card
            tone="warning"
            interactive
            onClick={() => navigate(ROUTES.FACE_REGISTER)}
            className="flex items-center gap-3"
          >
            <span className="bg-brand-900 flex size-11 shrink-0 items-center justify-center rounded-xl text-white">
              <ScanFace size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">얼굴 등록을 완료해 주세요</p>
              <p className="text-muted mt-0.5 text-xs">등록해야 티켓을 사용할 수 있어요.</p>
            </div>
            <ChevronRight size={18} className="text-subtle shrink-0" />
          </Card>
        )}

        {!isLoggedIn && (
          <Card tone="brand" className="space-y-4">
            <div className="flex items-center gap-3">
              <CatMascot size={52} />
              <div className="min-w-0">
                <p className="font-bold">로그인하고 예매를 시작하세요</p>
                <p className="text-muted mt-0.5 text-xs">
                  얼굴 등록까지 마치면 입장 준비 완료예요.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
                로그인
              </Button>
              <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.SIGNUP)}>
                회원가입
              </Button>
            </div>
          </Card>
        )}

        {/* 진행 중인 티켓팅 */}
        <section>
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => navigate(ROUTES.CONCERTS)}
                className="text-subtle hover:text-ink flex items-center text-xs transition-colors"
              >
                전체보기 <ChevronRight size={13} />
              </button>
            }
          >
            진행 중인 티켓팅
          </SectionTitle>

          {isPending ? (
            <SkeletonList count={2} />
          ) : (
            <Stagger as="ul" className="space-y-2">
              {open.map((concert) => (
                <Stagger.Item as="li" key={concert.id}>
                  <Card
                    interactive
                    padded={false}
                    onClick={() => navigate(ROUTES.CONCERT_DETAIL(concert.id))}
                    className="flex items-center gap-3 p-3"
                  >
                    <PosterImage
                      src={concert.posterUrl}
                      seed={concert.posterSeed}
                      alt={`${concert.title} 포스터`}
                      className="w-14 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{concert.title}</p>
                      <p className="text-muted truncate text-xs">{concert.artist}</p>
                      {concert.firstShowAt && (
                        <p className="text-subtle mt-1 truncate text-xs">
                          {formatDateTime(concert.firstShowAt)}
                        </p>
                      )}
                    </div>
                    <Badge tone="brand" size="md">
                      예매중
                    </Badge>
                  </Card>
                </Stagger.Item>
              ))}
            </Stagger>
          )}
        </section>
      </div>
    </div>
  );
}
