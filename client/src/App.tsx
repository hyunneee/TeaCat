import { RouterProvider } from 'react-router-dom';
import { AppProvider } from '@/app/providers';
import { router } from '@/app/router';
import { PwaUpdatePrompt } from '@/app/pwa/PwaUpdatePrompt';
import { CookieConsent } from '@/app/consent';

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
      <PwaUpdatePrompt />
      <CookieConsent />
    </AppProvider>
  );
}
