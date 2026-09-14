import { useState } from 'react';
import { Button } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { router } from '@/app/router';
import { readAnalyticsConsent, writeAnalyticsConsent, trackPageView } from '@/shared/lib';
import { startAnalytics } from '@/instrument';

/**
 * 분석 쿠키 동의 배너.
 *
 * GA4·Clarity 는 쿠키를 심고 수집한 것을 **국외로 이전**해서, 개인정보보호법상
 * 별도 동의가 필요합니다. 동의 전에는 스크립트조차 받지 않습니다 (`src/instrument.ts`).
 *
 * ── 왜 모달이 아니라 배너인가 ────────────────────────────
 * 화면을 덮는 모달로 만들면 **첫 화면을 못 보고 결정**해야 해서 대부분 아무거나
 * 눌러 치웁니다. 그건 동의를 받은 게 아니라 클릭을 받은 것입니다. 하단 배너는
 * 서비스를 보면서 정할 수 있고, 예매 흐름을 막지도 않습니다.
 *
 * 🔴 **거부를 허용과 같은 무게로 둡니다.** "허용" 만 크게 두고 거부를 회색 글씨로
 *    숨기는 패턴(다크 패턴)은 쓰지 않습니다. 둘 다 같은 크기 버튼입니다.
 *
 * 🔴 **결정을 미룰 수 있는 X 는 두지 않습니다.** 닫기만 하고 안 정하면 매 방문마다
 *    다시 떠서 더 성가시고, 그 사이 분석은 계속 꺼져 있습니다. 두 버튼 중 하나입니다.
 *
 * 🔴 허용을 누르면 **그 자리에서** 켭니다. 새로고침을 기다리면 그 세션의 유입 경로가
 *    통째로 빕니다 — 어디서 들어왔는지가 분석에서 가장 중요한 값입니다.
 *    이미 지나간 화면은 되살릴 수 없으니 **지금 보고 있는 화면 하나**만 보냅니다.
 *
 * 🔴 **`<Link>`·`useNavigate` 를 쓰면 안 됩니다.** 이 배너는 `App.tsx` 에서
 *    `RouterProvider` 의 **형제**로 마운트되므로 라우터 컨텍스트 밖입니다 —
 *    쓰는 순간 `Cannot destructure property 'basename'` 로 앱 전체가 터집니다
 *    (실제로 밟았습니다). 라우터 객체의 `navigate` 를 직접 부르면 컨텍스트가 필요 없습니다.
 *    라우터 안으로 옮기는 방법도 있지만, 그러면 레이아웃 없는 라우트에서 배너가 사라집니다.
 */
export function CookieConsent() {
  /* `null`(아직 안 물어봄)일 때만 뜹니다. 거부(`false`)한 사람에게 다시 띄우지 않습니다 —
     설정에서 직접 다시 선택할 수 있습니다. */
  const [decided, setDecided] = useState(() => readAnalyticsConsent() !== null);

  if (decided) return null;

  const choose = (allowed: boolean) => {
    writeAnalyticsConsent(allowed);
    setDecided(true);

    if (!allowed) return;
    startAnalytics();
    trackPageView(window.location.pathname);
  };

  return (
    <div
      className="app-width fixed inset-x-0 bottom-0 z-[70] mx-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="분석 쿠키 사용 동의"
    >
      <div className="surface space-y-3 rounded-2xl border p-4 shadow-xl">
        <p className="text-sm leading-relaxed">
          서비스 개선을 위해 이용 통계를 수집합니다. 이 정보는 미국(Google·Microsoft)으로
          이전됩니다. 거부해도 예매를 포함한 모든 기능을 그대로 쓸 수 있어요.
        </p>

        <button
          type="button"
          onClick={() => void router.navigate(ROUTES.PRIVACY)}
          className="text-muted inline-block text-xs underline underline-offset-2"
        >
          개인정보처리방침 보기
        </button>

        {/* 두 버튼의 크기를 같게 둡니다 — 거부를 숨기지 않습니다 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => choose(false)}>
            거부
          </Button>
          <Button onClick={() => choose(true)}>동의</Button>
        </div>
      </div>
    </div>
  );
}
