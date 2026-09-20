/**
 * 실제 라우터·진입 가드·쿼리 훅을 Chromium에서 검증한다.
 * 실행: node scripts/check-booking-access.mjs
 * BROWSER_PATH로 Chrome/Edge 실행 파일을 지정할 수 있다. 새 패키지 설치는 필요 없다.
 * 로그인/화면 본문/API만 대체하며 운영 서버에 연결하지 않는다.
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browserPath = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path) => path && existsSync(path));
if (!browserPath) throw new Error('Chrome/Edge가 필요합니다. BROWSER_PATH를 지정하세요.');

const apiStub = `
  export { ApiError } from ${JSON.stringify(join(root, 'src/shared/api/ApiError.ts'))};
  import { ApiError } from ${JSON.stringify(join(root, 'src/shared/api/ApiError.ts'))};
  export const http = { get: (url, options) => {
    window.requests.push(url);
    const fixture = { ...window.fixture };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fixture.error
        ? reject(new ApiError({status: fixture.error, code: 'TEST', message: 'test error'}))
        : resolve({scheduleId: Number(url.split('/').pop()), concertId: 42, bookingStatus: fixture.status}), fixture.delay ?? 20);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError'));
      }, {once: true});
    });
  }};
`;
const stubs = {
  '@sentry/react': 'export const wrapCreateBrowserRouter = (create) => create;',
  '@/shared/config': 'export const IS_DEV_BUILD = false;',
  '@/shared/api': apiStub,
  '@/features/concert': `export { useBookingAccess } from ${JSON.stringify(join(root, 'src/features/concert/hooks/useBookingAccess.ts'))};`,
  '@/shared/components/common': `
    import {Suspense} from 'react';
    export const PageLoader = () => <p>CHECKING</p>;
    export const EmptyState = ({title, description, action}) => <div>{title}{description}{action}</div>;
    export const RouteBoundary = ({children}) => <Suspense fallback={<PageLoader/>}>{children}</Suspense>;
  `,
  '@/shared/components/layout': `
    import {Outlet} from 'react-router-dom';
    export const AppLayout = Outlet, PlainLayout = Outlet, SearchLayout = Outlet;
    export const Header = ({title}) => <h1>{title}</h1>;
  `,
  '@/shared/components/ui': 'export const Button = ({children, onClick}) => <button onClick={onClick}>{children}</button>;',
  '@/features/admin': `import {Outlet} from 'react-router-dom'; export const AdminLayout = Outlet;`,
  './guards': `
    import {Outlet} from 'react-router-dom';
    export const RequireAuth = Outlet, RequireFace = Outlet, RequireCaptcha = Outlet, RequireQueue = Outlet, RequireRole = Outlet;
  `,
};

const harness = `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {QueryClient, QueryClientProvider, focusManager, onlineManager} from '@tanstack/react-query';
  import {RouterProvider} from 'react-router-dom';
  import {router} from './src/app/router/router';
  window.fixture = {status: 'CLOSED'}; window.requests = []; window.rendered = [];
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>);
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const text = () => document.body.textContent;
  const assert = (condition, message) => { if (!condition) throw new Error(message + ': ' + text()); };
  const until = async (check) => { for (let i=0; i<150; i++) {if (check()) return; await sleep(20);} throw new Error('timeout: ' + text()); };
  const results = [];
  const run = async (name, check) => { await check(); results.push(name); };
  const navigate = async (path, fixture = {status:'CLOSED'}) => {
    window.fixture = fixture; window.rendered = []; window.requests = [];
    await router.navigate(path); await sleep(60);
  };
  window.runChecks = async () => {
    for (const path of ['verify','waiting','section','seats']) {
      await run('CLOSED direct /' + path, async () => {
        await navigate('/booking/1/' + path);
        await until(() => text().includes('예매가 종료된 회차'));
        assert(window.rendered.length === 0, 'protected child must never render');
      });
    }
    await run('OPEN response must arrive before child renders', async () => {
      await navigate('/booking/2/seats', {status:'OPEN', delay:250});
      assert(text().includes('CHECKING') && window.rendered.length === 0, 'pending must block');
      await until(() => text().includes('SeatSelectPage'));
    });
    await run('back navigation must not trust previous OPEN', async () => {
      await navigate('/concerts'); window.fixture = {status:'CLOSED', delay:200}; window.rendered = [];
      await router.navigate(-1); await sleep(60);
      assert(!window.rendered.includes('SeatSelectPage'), 'stale OPEN flashed on back');
      await until(() => text().includes('예매가 종료된 회차'));
      assert(!window.rendered.includes('SeatSelectPage'), 'closed page rendered');
    });
    await run('BEFORE blocks; SOLDOUT is not CLOSED', async () => {
      await navigate('/booking/3/section', {status:'BEFORE'});
      await until(() => text().includes('아직 예매가 시작되지'));
      assert(window.rendered.length === 0, 'BEFORE child rendered');
      await navigate('/booking/3/seats', {status:'SOLDOUT'});
      await until(() => text().includes('SeatSelectPage'));
    });
    await run('invalid IDs skip the API', async () => {
      for (const id of ['abc','0','-1','9007199254740992']) {
        await navigate('/booking/' + id + '/seats');
        await until(() => text().includes('회차를 찾을 수'));
        assert(window.requests.length === 0 && window.rendered.length === 0, 'invalid ID requested/rendered');
      }
    });
    await run('404 and failed request block; retry recovers', async () => {
      await navigate('/booking/4/seats', {error:404});
      await until(() => text().includes('회차를 찾을 수'));
      await navigate('/booking/5/seats', {error:503});
      await until(() => text().includes('예매 상태를 확인하지 못했어요'));
      assert(window.rendered.length === 0, 'failed request child rendered');
      window.fixture = {status:'OPEN'};
      [...document.querySelectorAll('button')].find(button => button.textContent === '다시 시도').click();
      await until(() => text().includes('SeatSelectPage'));
    });
    await run('focus return revalidates and rejects CLOSED', async () => {
      await navigate('/booking/6/seats', {status:'OPEN'});
      await until(() => text().includes('SeatSelectPage'));
      window.fixture = {status:'CLOSED'};
      focusManager.setFocused(false); focusManager.setFocused(true);
      await until(() => text().includes('예매가 종료된 회차'));
    });
    await run('bfcache pageshow revalidates', async () => {
      await navigate('/booking/7/seats', {status:'OPEN'});
      await until(() => text().includes('SeatSelectPage'));
      window.fixture = {status:'CLOSED'};
      window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));
      await until(() => text().includes('예매가 종료된 회차'));
    });
    await run('offline entry blocks without endless loader; reconnect recovers', async () => {
      onlineManager.setOnline(false);
      await navigate('/booking/8/seats', {status:'OPEN'});
      await until(() => text().includes('예매 상태를 확인하지 못했어요'));
      assert(window.rendered.length === 0, 'offline child rendered');
      onlineManager.setOnline(true);
      await until(() => text().includes('SeatSelectPage'));
    });
    await run('late response from previous schedule does not admit next schedule', async () => {
      await navigate('/booking/9/seats', {status:'OPEN', delay:350});
      await navigate('/booking/10/seats', {status:'CLOSED'});
      await until(() => text().includes('예매가 종료된 회차')); await sleep(400);
      assert(!window.rendered.includes('SeatSelectPage'), 'late response admitted next schedule');
    });
    await run('closed notice links to concert detail', async () => {
      [...document.querySelectorAll('button')].find(button => button.textContent === '공연 상세로').click();
      await until(() => location.pathname === '/concerts/42');
    });
    for (const [path, page] of [
      ['/booking/1/review','BookingReviewPage'], ['/booking/1/payment','PaymentPage'],
      ['/booking/1/payment/result','PaymentResultPage'], ['/booking/done/1','BookingDonePage'],
      ['/booking/1/resale','ResalePage'],
    ]) {
      await run('existing flow remains outside guard: ' + page, async () => {
        await navigate(path); await until(() => text().includes(page));
        assert(window.requests.length === 0, 'access query blocked an existing flow');
      });
    }
    return results;
  };
`;

const bundle = await build({
  absWorkingDir: root, stdin: { contents: harness, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'booking-check-boundaries', setup(api) {
    api.onResolve({ filter: /.*/ }, ({ path }) => {
      if (path in stubs || path.startsWith('@/pages/')) return { path, namespace: 'fixture' };
      if (path.startsWith('@/')) {
        const local = join(root, 'src', path.slice(2));
        return { path: existsSync(local + '.ts') ? local + '.ts' : join(local, 'index.ts') };
      }
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
      const name = path.split('/').pop();
      return { loader: 'tsx', resolveDir: root, contents: stubs[path] ??
        'export function ' + name + '() { window.rendered.push("' + name + '"); return <p>' + name + '</p>; }' };
    });
  }}],
});
const profile = await mkdtemp(join(tmpdir(), 'teacat-booking-check-'));
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/test.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/test.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/test.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error('Headless browser startup timed out');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, {once:true}));
  let id = 0;
  const pending = new Map();
  const loaded = new Promise(resolve => socket.addEventListener('message', ({data}) => {
    const message = JSON.parse(data);
    if (message.method === 'Page.loadEventFired') resolve();
    if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  }));
  const send = (method, params = {}) => new Promise(resolve => {
    pending.set(++id, resolve); socket.send(JSON.stringify({id, method, params}));
  });
  await send('Page.enable');
  await send('Page.navigate', {url: 'http://127.0.0.1:' + server.address().port + '/'});
  await loaded;
  const output = await send('Runtime.evaluate', {expression: 'window.runChecks()', awaitPromise:true, returnByValue:true});
  if (output.error || output.result.exceptionDetails) throw new Error(JSON.stringify(output));
  for (const name of output.result.result.value) console.log('PASS ' + name);
  let documentChecks = 0;
  for (const path of ['verify', 'waiting', 'section', 'seats']) {
    for (const reload of [false, true]) {
      const documentLoaded = new Promise(resolve => {
        const listener = ({data}) => {
          if (JSON.parse(data).method === 'Page.loadEventFired') {
            socket.removeEventListener('message', listener);
            resolve();
          }
        };
        socket.addEventListener('message', listener);
      });
      await send(reload ? 'Page.reload' : 'Page.navigate', reload ? {} : {
        url: 'http://127.0.0.1:' + server.address().port + '/booking/1/' + path,
      });
      await documentLoaded;
      const check = await send('Runtime.evaluate', {
        expression: `(async () => {
          for (let i = 0; i < 150; i++) {
            if (document.body.textContent.includes('예매가 종료된 회차')) {
              if (window.rendered.length !== 0) throw new Error('Protected child rendered');
              return true;
            }
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          throw new Error('Closed notice timed out');
        })()`,
        awaitPromise: true, returnByValue: true,
      });
      if (check.error || check.result.exceptionDetails) throw new Error(JSON.stringify(check));
      documentChecks++;
      console.log('PASS CLOSED ' + (reload ? 'reload /' : 'document entry /') + path);
    }
  }
  console.log('Passed ' + (output.result.result.value.length + documentChecks) + ' browser checks (fixture API/UI, actual router/guard/query).');
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-booking-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
}
