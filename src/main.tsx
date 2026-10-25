import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './ThemeProvider';
import { setupServiceWorker } from './setupServiceWorker';
import { useAuthStore } from './store/authStore';
import { restoreSnapshots, startSnapshotPersistence } from './lib/snapshotSync';
import { registerAppFonts } from './lib/appFonts';
import { registerCardFonts } from './lib/cardFonts';
import { AppDownloadPrompt } from './components/features/update/AppDownloadPrompt';
// Technor (English) and FN Shorif Shadhin (Bengali) come from public/fonts and are
// registered in lib/appFonts. The bundled fonts below are the fallbacks: they are
// used for any character those two don't have, and for everything until the two
// font files are in public/fonts. They work offline inside the Android app.
import '@fontsource/patrick-hand/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/atma/400.css';
import '@fontsource/atma/500.css';
import '@fontsource/atma/600.css';
import './styles/globals.css';

setupServiceWorker();
registerAppFonts();
registerCardFonts();
useAuthStore.getState().init();

// init() reads the login saved on the device synchronously, so the last saved
// copy of the lists can be in place before the first screen is drawn — the app
// opens with data even with no connection.
const savedUserId = useAuthStore.getState().user?.id;
if (savedUserId) restoreSnapshots(savedUserId);
startSnapshotPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <AppDownloadPrompt />
    </ThemeProvider>
  </StrictMode>
);
