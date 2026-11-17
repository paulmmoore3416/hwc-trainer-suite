import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SUPABASE_HOST = 'qenuszfbkiedvloytrlc.supabase.co';

// Content-Security-Policy is injected only into production builds (dev needs inline HMR scripts).
function csp(): Plugin {
  return {
    name: 'hwc-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), csp()],
  build: { chunkSizeWarningLimit: 2000, sourcemap: false },
});
