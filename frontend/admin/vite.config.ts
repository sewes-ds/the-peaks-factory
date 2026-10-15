import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    proxy: {
      '/admin-api': {
        target: devApiProxyTarget,
        changeOrigin: false
      }
    }
  },
  test: {
    environment: 'jsdom'
  }
});
