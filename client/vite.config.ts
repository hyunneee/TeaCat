import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.[mode] 를 읽어온다. (VITE_ 접두사만 클라이언트로 노출됨)
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isProd = mode === 'production';

  /* ── Sentry 소스맵 업로드 ─────────────────────────────────────────
     운영 빌드는 난독화돼서 스택이 `index-a3f9.js:1:24817` 로 온다.
     소스맵을 **Sentry 에만** 올리고 배포본에서는 지워서, 대시보드에서는 원본 줄이
     보이고 브라우저에서는 아무도 소스를 못 받게 한다.

     🔴 이 세 값에 `VITE_` 를 붙이지 마라. 붙이는 순간 번들에 박혀서 토큰이
        공개된다 — 그 토큰 하나면 우리 Sentry 프로젝트에 아무나 쓸 수 있다.
        CI 빌드 환경변수 전용이라 `process.env` 로 읽는다.
        (그래서 vite-env.d.ts·shared/config/env.ts 에도 넣지 않는다.
         CLAUDE.md 3-3 은 `import.meta.env` 에 대한 규칙이라 여기엔 해당 없음)

     토큰이 없으면 **업로드도, 소스맵 생성도 하지 않는다.** 로컬 `npm run build` 와
     토큰을 아직 안 넣은 젠킨스는 예전과 글자 하나 다르지 않게 동작한다. */
  const sentry = {
    authToken: (process.env.SENTRY_AUTH_TOKEN ?? '').trim(),
    org: (process.env.SENTRY_ORG ?? '').trim(),
    project: (process.env.SENTRY_PROJECT ?? '').trim(),
  };
  const uploadSourcemaps = isProd && Boolean(sentry.authToken && sentry.org && sentry.project);

  /* 런타임 SDK 가 보고하는 release 와 **글자까지 같아야** 짝이 맞는다.
     다르면 업로드는 초록불인데 이슈에는 계속 난독화된 스택이 뜬다 —
     경고도 안 난다. 기본값 규칙을 shared/config/env.ts 의 sentryConfig 와 맞춰 둔다. */
  const sentryRelease =
    (env.VITE_SENTRY_RELEASE ?? '').trim() ||
    `teacat-client@${(env.VITE_APP_VERSION ?? '').trim() || '0.0.0'}`;

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
          /* 🔴 서비스워커 소스맵(sw.js.map · workbox-*.js.map)을 운영에서 만들지 않는다.
             build.sourcemap 을 'hidden' 으로 켜면 워크박스도 따라서 맵을 뱉는데,
             이건 Sentry 플러그인이 dist 를 청소한 **뒤에** 생성돼서 살아남고
             그대로 배포된다. 여기서 끄는 게 원천 차단이다.
             (client/Dockerfile 의 find -delete 는 그래도 남는 경우를 위한 그물) */
          sourcemap: !isProd,
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

      /* 🔴 **맨 마지막**이어야 한다. 앞 플러그인들이 다 만든 최종 산출물에
         debug id 를 심어야 번들과 소스맵의 짝이 맞는다.
         토큰이 없으면 아예 끼지 않는다 (위 uploadSourcemaps). */
      ...(uploadSourcemaps
        ? [
            sentryVitePlugin({
              org: sentry.org,
              project: sentry.project,
              authToken: sentry.authToken,
              release: { name: sentryRelease },
              sourcemaps: {
                /* 🔴 올린 **직후 dist 에서 지운다.** 이 줄이 없으면 .map 이 그대로
                   배포돼 `https://dev.teacat.site/assets/index-xxx.js.map` 으로
                   **전체 소스가 공개**된다. 업로드보다 이쪽이 더 중요하다. */
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
              /* 커밋 연결(setCommits)은 켜지 않는다. 도커 빌드 컨텍스트가 ./client 이고
                 .dockerignore 가 .git/ 을 빼서 저장소 정보가 없다. 필요해지면
                 젠킨스가 커밋 해시를 넘겨 repo/commit 을 직접 지정해야 한다. */
              telemetry: false,

              /* 🔴 업로드 실패로 **배포를 막지 않는다.** 기본값은 빌드를 실패시키는데,
                 그러면 Sentry API 가 잠깐 흔들리거나 토큰이 만료된 날 프론트 배포가
                 통째로 멈춘다. 소스맵은 디버깅 편의지 배포 조건이 아니다.
                 대신 로그에 남기고, 지워지지 않은 .map 은 Dockerfile 의
                 `find ... -delete` 가 받아낸다. */
              errorHandler: (err) => {
                console.warn('[sentry] 소스맵 업로드 실패. 배포는 계속합니다:', err.message);
              },
            }),
          ]
        : []),
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
      /* 운영 번들에는 소스맵을 **남기지 않는다.** 업로드할 때만 만들고 올린 뒤 지운다.
         'hidden' 은 .map 파일은 만들되 번들 끝의 `//# sourceMappingURL=` 주석은
         넣지 않는 모드다 — 올린 뒤 .map 을 지우기 때문에, 주석이 남으면 devtools 가
         있지도 않은 파일을 찾아 404 를 계속 낸다. Sentry 는 그 주석이 아니라
         플러그인이 심은 debug id 로 짝을 찾으므로 없어도 된다. */
      sourcemap: isProd ? (uploadSourcemaps ? 'hidden' : false) : true,
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
