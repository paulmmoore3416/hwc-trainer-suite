import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/great-vibes/latin-400.css';
import './index.css';
import App from './App';
import { supabase } from './lib/supabase';
import { installGlobalErrorHandlers, logError } from './lib/errors';
import { applyInitialColorMode, ColorModeProvider } from './lib/theme';

installGlobalErrorHandlers();
applyInitialColorMode();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { onError: (e) => logError(e, { kind: 'mutation' }) },
  },
});

/**
 * Supabase email links (password reset) land as `#access_token=…&type=recovery`, which collides with hash routing.
 * Let supabase-js consume the tokens first, then move to a real route.
 */
async function boot() {
  const raw = window.location.hash.slice(1);
  if (/(^|&)(access_token|error_description)=/.test(raw)) {
    const params = new URLSearchParams(raw);
    const type = params.get('type');
    await supabase.auth.getSession();
    if (type === 'recovery' || type === 'invite') sessionStorage.setItem('hwc-recovery', '1');
    const target = params.get('error_description') ? '#/login?error=' + encodeURIComponent(params.get('error_description')!) : type === 'recovery' || type === 'invite' ? '#/set-password' : '#/';
    window.history.replaceState(null, '', window.location.pathname + window.location.search + target);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ColorModeProvider>
    </StrictMode>,
  );
}

void boot();
