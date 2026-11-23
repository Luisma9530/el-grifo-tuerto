import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Third-party libraries in chunks of their own: they change far less often than
// the game, so the browser keeps them cached between deployments.
const VENDOR_CHUNKS = [
  ['react', /\/node_modules\/(react|react-dom|scheduler)\//],
  // The 3D dice (loaded on the first roll)
  ['three', /\/node_modules\/three\//],
  ['cannon', /\/node_modules\/cannon-es\//],
  // The online room's connection (loaded only when playing online with Supabase)
  ['supabase', /\/node_modules\/(@supabase|iceberg-js|tslib)\//],
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // three.js (~520 kB, 129 kB gzip) cannot be split further: WebGLRenderer
    // carries most of it. It is loaded only for the 3D dice, after the game is on
    // screen, so it never weighs on the first load. Every other chunk is far smaller.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(id))?.[0];
        },
      },
    },
  },
});
