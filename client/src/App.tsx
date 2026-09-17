import { RouterProvider } from 'react-router-dom';
import { AppProvider } from '@/app/providers';
import { router } from '@/app/router';
import { PwaAutoUpdate } from '@/app/pwa/PwaAutoUpdate';

/* 🔴 쿠키 동의 배너(`app/consent/CookieConsent.tsx`)를 **일부러 붙이지 않았습니다.**
   1차는 테스트 운영이라 동의를 묻지 않고 바로 수집하는 쪽을 택했습니다
   (`src/instrument.ts` 의 opt-out 판단). 컴포넌트는 지우지 않고 남겨 두었으니,
   실사용자를 받는 운영으로 넘어갈 때 이 줄만 되살리면 됩니다 —
   `<CookieConsent />` 를 `<PwaAutoUpdate />` 아래에 다시 넣고 instrument 의
   조건을 `=== true` 로 바꾸세요. */

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
      <PwaAutoUpdate />
    </AppProvider>
  );
}
