import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// База по умолчанию — для GitHub Pages проекта (https://<user>.github.io/dabudi/).
// Для хостинга в корне домена (например, Netlify) можно собрать с VITE_BASE=/.
const base = process.env.VITE_BASE ?? '/dabudi/';

export default defineConfig(() => {
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // регистрируем сами в main.tsx
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Репетитор — CRM',
          short_name: 'Репетитор',
          description:
            'Учёт учеников, расписание, оплаты и заметки для репетитора.',
          lang: 'ru',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0a0a0a',
          theme_color: '#0a0a0a',
          icons: [
            {src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Кадры питомца весят больше, чем всё остальное приложение вместе
          // взятое, а офлайн он не критичен. Поэтому не кладём их в стартовый
          // предкэш, а кэшируем при первом показе — дальше он доступен офлайн.
          globIgnores: ['**/pet/*.png'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.pathname.includes('/pet/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pet-assets',
                expiration: {maxEntries: 12},
              },
            },
          ],
        },
        devOptions: {enabled: false},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
