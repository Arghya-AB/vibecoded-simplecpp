import { defineConfig } from 'vite';

// SharedArrayBuffer is used only to make `wait()`, `getClick()` and interactive
// stdin genuinely non-blocking. It requires a cross-origin isolated page.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 100_000,
  },
});
