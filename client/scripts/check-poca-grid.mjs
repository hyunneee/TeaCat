/** CSS layout fixtures using the source grid classes and actual card components.
 * Run vite build first, then node scripts/check-poca-grid.mjs.
 * Does not exercise page API, authentication or infinite scroll.
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
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
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path) => path && existsSync(path));
if (!browserPath) throw new Error('Chrome/Edge가 필요합니다. BROWSER_PATH를 지정하세요.');

const marketSource = await readFile(join(root, 'src/pages/NftMarketPage.tsx'), 'utf8');
const mineSource = await readFile(join(root, 'src/pages/MyNftsPage.tsx'), 'utf8');
const gridClass = (source) => source.match(/<ul className="(grid grid-cols[^"\n]+)"/)[1];
const marketGrid = gridClass(marketSource),
  mineGrid = gridClass(mineSource);
const cssFiles = (await readdir(join(root, 'dist/assets'))).filter((name) => name.endsWith('.css'));
const css = (
  await Promise.all(cssFiles.map((name) => readFile(join(root, 'dist/assets', name), 'utf8')))
).join('\n');
const stubs = {
  '@/shared/constants': `export {ROUTES} from ${JSON.stringify(join(root,'src/shared/constants/routes.ts'))};`,
  '@/shared/search': `export const SearchEntryButton=()=> <button>Search</button>; export const TrendingSearchInput = () => <input aria-label="search"/>;`,
  '@/shared/components/common': `export {Outlet as PageTransition} from 'react-router-dom';`,
  '@/shared/lib': `export {clsx as cn} from 'clsx'; export const SPRING={type:'spring'}; export const formatDate = value => value; export const parseServerTime = value => new Date(value);`,
  '@/shared/components/ui': `export const Logo=()=> <span>TEACAT</span>; export const Badge=({children,className})=><span className={className}>{children}</span>; export const Skeleton=({className})=><div className={className}/>;`,
};
const harness = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NftCard} from './src/features/nft/components/NftCard';
import {PocaGridTile} from './src/features/nft/components/PocaGridTile';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {AppLayout} from './src/shared/components/layout/AppLayout';
const root=createRoot(document.getElementById('root'));
let router;
window.renderFixture = (mine) => {
router?.dispose();
const content=<div className="p-4 lg:px-0">
<ul data-grid className={mine ? ${JSON.stringify(mineGrid)} : ${JSON.stringify(marketGrid)}}>
{Array.from({length:15},(_,i)=><li key={i}>{mine ? <PocaGridTile label={'Long card name '.repeat(12)} caption={'Long group '.repeat(12)} art={<div className="size-full surface-2"/>}/> : <NftCard photocardId={i} designName={'Long card name '.repeat(12)} imageUrl={null} performanceTitle={'Long title '.repeat(12)} price={999999999999999} onClick={()=>{}}/>}</li>)}
</ul></div>;
router=createMemoryRouter([{element:<AppLayout/>,children:[{path:'/',element:content}]}]);
root.render(<RouterProvider key={String(mine)} router={router}/>);
};
window.runChecks = async (width,mine) => {
window.renderFixture(mine);
await new Promise(r=>setTimeout(r,100));
const grid=document.querySelector('[data-grid]');
const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
const expected=width<768?2:width<1024?3:5;
if(columns!==expected) throw new Error('columns '+columns+' expected '+expected);
if(document.documentElement.scrollWidth>width)throw new Error('horizontal overflow');
for(const element of grid.querySelectorAll('li')) if(element.scrollWidth>element.clientWidth+1)throw new Error('card overflow');
const shell=document.querySelector('.app-shell');
if(getComputedStyle(shell).flexDirection!=='column')throw new Error('shell must stack header and content vertically');
if(width>=1024){
const header=shell.querySelector(':scope > header').getBoundingClientRect();
const main=shell.querySelector('main').getBoundingClientRect();
if(main.top<header.bottom-1||grid.getBoundingClientRect().top<header.bottom-1)throw new Error('cards must appear below desktop header and tabs');
if(header.width<width-2)throw new Error('desktop header width collapsed');
}
if(width>=768&&width<1024){
const bottom=shell.querySelector(':scope > nav');
if(!bottom || Math.abs(bottom.getBoundingClientRect().width-shell.getBoundingClientRect().width)>2)throw new Error('tablet content must match bottom navigation width');
}
return (mine?'collection':'market')+' '+width+'px: '+columns+' columns, no overflow';
};
window.renderFixture(false);
`;

const bundle = await build({
  absWorkingDir: root,
  stdin: { contents: harness, loader: 'tsx', resolveDir: root },
  loader: { '.webp': 'dataurl', '.png': 'dataurl' },
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [
    {
      name: 'booking-check-boundaries',
      setup(api) {
        api.onResolve({ filter: /.*/ }, ({ path }) => {
          if (path in stubs) return { path, namespace: 'fixture' };
          if (path.startsWith('@/')) {
            const local = join(root, 'src', path.slice(2));
            return {
              path: existsSync(local + '.ts')
                ? local + '.ts'
                : existsSync(local + '.tsx')
                  ? local + '.tsx'
                  : join(local, 'index.ts'),
            };
          }
        });
        api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
          const name = path.split('/').pop();
          return {
            loader: 'tsx',
            resolveDir: root,
            contents:
              stubs[path] ??
              'export function ' +
                name +
                '() { window.rendered.push("' +
                name +
                '"); return <p>' +
                name +
                '</p>; }',
          };
        });
      },
    },
  ],
});
const profile = await mkdtemp(join(tmpdir(), 'teacat-poca-grid-check-'));
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Type',
    req.url === '/test.js' ? 'text/javascript' : 'text/html; charset=utf-8',
  );
  res.end(
    req.url === '/test.js'
      ? bundle.outputFiles[0].text
      : '<style>' + css + '</style><div id="root"></div><script src="/test.js"></script>',
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!port) throw new Error('Headless browser startup timed out');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const loaded = new Promise((resolve) =>
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Page.loadEventFired') resolve();
      if (pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }),
  );
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' });
  await loaded;
  for (const width of [360, 767, 768, 1023, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const mine of [false, true]) {
      const output = await send('Runtime.evaluate', {
        expression: 'window.runChecks(' + width + ',' + mine + ')',
        awaitPromise: true,
        returnByValue: true,
      });
      if (output.error || output.result.exceptionDetails) throw new Error(JSON.stringify(output));
      console.log('PASS ' + output.result.result.value);
    }
  }
  await send('Browser.close');
} finally {
  socket?.close();
  browser.kill();
  server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-poca-grid-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
