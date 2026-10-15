import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const appRootPath = process.env.APP_ROOT_PATH;
const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  base: '/peaks/',
  plugins: [react()],
  server: {
    proxy: {
      '/peaks/api': {
        target: devApiProxyTarget,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/peaks\/api/, '')
      }
    }
  },
  test: {
    environment: 'jsdom'
  }
});
