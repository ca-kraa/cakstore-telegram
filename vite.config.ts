import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 58420,
    proxy: {
      '/api': {
        target: 'http://localhost:58421',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:58421',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Ignore normal client disconnects
            if ((err as any).code === 'ECONNABORTED' || (err as any).code === 'ECONNRESET') return;
            console.warn('[Vite WS Proxy]', err.message);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});
