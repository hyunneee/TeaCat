import { RouterProvider } from 'react-router-dom';
import { AppProvider } from '@/app/providers';
import { router } from '@/app/router';
import { PwaAutoUpdate } from '@/app/pwa/PwaAutoUpdate';
import { CookieConsent } from '@/app/consent';

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
      <PwaAutoUpdate />
      <CookieConsent />
    </AppProvider>
  );
}
