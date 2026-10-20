import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './ThemeProvider';
import { setupServiceWorker } from './setupServiceWorker';
import { useAuthStore } from './store/authStore';
import { AppDownloadPrompt } from './components/features/update/AppDownloadPrompt';
// Bundled fonts (work offline inside the Android app)
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
// Bengali: the Latin fonts above have no Bengali letters, so anything typed in
// Bengali falls through to Tiro Bangla (see the font stacks in tailwind.config.ts).
import '@fontsource/tiro-bangla/400.css';
import '@fontsource/tiro-bangla/400-italic.css';
import './styles/globals.css';

setupServiceWorker();
useAuthStore.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <AppDownloadPrompt />
    </ThemeProvider>
  </StrictMode>
);
