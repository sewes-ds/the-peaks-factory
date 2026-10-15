import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/',
  publicDir: resolve(__dirname, '../public'),
  plugins: [react()],
});
