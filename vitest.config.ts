import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

// Тесты компонентов идут в jsdom. Конфиг отдельный от vite.config.ts,
// чтобы не тянуть в тесты PWA-плагин и Tailwind.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
