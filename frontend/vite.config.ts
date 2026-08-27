import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.[mode] 를 읽어온다. (VITE_ 접두사만 클라이언트로 노출됨)
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isProd = mode === 'production';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt', // 새 버전 배포 시 사용자에게 "새로고침?" 안내
        injectRegister: 'auto',
        // 개발 중에도 서비스워커를 테스트하고 싶으면 true 로 바꾸세요.
        devOptions: { enabled: false },
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          name: '티캣 — 암표 없는 티켓 예매',
          short_name: '티캣',
          description: '티캣 — 얼굴 인증 기반 암표 방지 티켓 예매 서비스',
          lang: 'ko',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // API 응답은 절대 캐싱하지 않는다.
          // 좌석 잔여/티켓 상태를 캐시된 값으로 보여주면 대형 사고.
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: 'NetworkOnly',
            },
            {
              // 포스터/포토카드 이미지는 캐싱 이득이 큼
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
              },
            },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: 5173,
      host: true, // 같은 wifi 의 실제 휴대폰에서 접속해 PWA 테스트
      proxy: {
        // 개발 환경에서만 CORS 우회. 배포는 nginx / 게이트웨이가 담당.
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_WS_PROXY_TARGET ?? 'ws://localhost:8080',
          ws: true,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: !isProd, // 운영 번들에는 소스맵 미포함
      rollupOptions: {
        output: {
          // 벤더 청크 분리 → 재배포 시 캐시 히트율 상승
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },

    esbuild: {
      // 운영 빌드에서 console.log / debugger 제거
      drop: isProd ? ['console', 'debugger'] : [],
    },
  };
});
