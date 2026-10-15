import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/',
  publicDir: resolve(__dirname, '../public'),
  plugins: [react()],
  server: { host: '127.0.0.1', strictPort: true },
});
