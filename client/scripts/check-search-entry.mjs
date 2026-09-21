/** Local Chromium regression checks for search entry, input and trends.
 * Run: node scripts/check-search-entry.mjs (requires Chrome/Edge and Node 22+).
 * Uses the actual SearchPage and search hooks with fixture API responses.
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

const stubs = {
  '@/shared/constants': `export { ROUTES } from ${JSON.stringify(join(root, 'src/shared/constants/routes.ts'))};`,
  '@/shared/api': `export const http = {get: async () => window.trends, post: async (url, body) => {window.searches.push(body.keyword); return {concerts:[], photocards:[]};}};`,
  '@/shared/lib': `export const cn = (...args) => args.filter(Boolean).join(' '); export const getViewSessionId = () => 'test';`,
  '@/shared/components/layout': `export const Header = () => null;`,
  '@/shared/components/ui': `export { Input } from ${JSON.stringify(join(root, 'src/shared/components/ui/Input.tsx'))}; export const Logo = () => <span>TEACAT</span>; export const SectionTitle = ({children}) => <h2>{children}</h2>;`,
  '@/shared/components/common': `export const EmptyState = ({title}) => <p>{title}</p>; export const Loading = () => <p>Loading</p>;`,
  '@/features/concert': `export const ConcertCard = () => null;`,
  '@/features/nft': `export const NftCard = () => null;`,
};
const harness = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createBrowserRouter, RouterProvider, Outlet} from 'react-router-dom';
import {TopNav} from './src/shared/components/layout/TopNav';
import {SearchPage} from './src/pages/SearchPage';
window.searches=[];
window.trends={items:Array.from({length:10},(_,i)=>({rank:i+1,keyword:'keyword'+i,trend:'NEW',previousRank:null})),nextRefreshAt:new Date(Date.now()+3600000).toISOString()};
localStorage.clear();
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Layout(){return <><TopNav/><Outlet/></>;}
const router=createBrowserRouter([{element:<Layout/>,children:[{path:'/',element:<div/>},{path:'/search',element:<SearchPage/>}]}]);
const style=document.createElement('style');style.textContent='div[class~="lg:hidden"] {display:none}';document.head.append(style);
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(20);}throw new Error('timeout');};
window.runChecks=async()=>{
const results=[];
await until(()=>document.querySelector('button')?.textContent.includes('keyword0'));
assert(window.searches.length===0,'entry fetched results');
await until(()=>document.querySelector('button')?.textContent.includes('keyword1'));
for (let i=2;i<=10;i++) await until(()=>document.querySelector('button')?.textContent.includes('keyword'+(i%10)));
results.push('entry rotates through ten items and wraps without submitting');
document.querySelector('button').click();
await until(()=>document.querySelector('input'));
assert(location.search==='' && window.searches.length===0,'entry must not submit');
assert(document.activeElement===document.querySelector('input'),'input not focused');
await until(()=>document.querySelectorAll('li').length===10);
results.push('entry opens empty search, focuses input and shows 10 trends');
document.querySelector('li button').click();
await until(()=>window.searches.length===1);
assert(window.searches[0]==='keyword0','wrong trend submitted');
await until(()=>document.querySelector('header input')?.value==='keyword0');
assert(document.querySelector('input').closest('header'),'desktop search must use TopNav');
results.push('trend selection submits keyword');
const input=document.querySelector('input');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'another');
input.dispatchEvent(new Event('input',{bubbles:true}));await sleep(50);
assert(window.searches.length===1,'typing submitted');
document.querySelector('form').requestSubmit();
await until(()=>window.searches.length===2);
assert(window.searches[1]==='another','input not submitted');
results.push('typing does not submit; form submission searches');
await router.navigate('/search');await sleep(50);
for(const count of [0,1,10,1]){
client.setQueryData(['global-search-trends'],{...window.trends,items:window.trends.items.slice(0,count)});
await sleep(50);assert(document.querySelectorAll('li').length===count,'trend count mismatch');
}
results.push('zero, one, ten and shrinking trend lists');
return results;
};
`;

const bundle = await build({
  absWorkingDir: root, stdin: { contents: harness, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'booking-check-boundaries', setup(api) {
    api.onResolve({ filter: /.*/ }, ({ path }) => {
      if (path in stubs) return { path, namespace: 'fixture' };
      if (path.startsWith('@/')) {
        const local = join(root, 'src', path.slice(2));
        return { path: existsSync(local + '.ts') ? local + '.ts' : existsSync(local + '.tsx') ? local + '.tsx' : join(local, 'index.ts') };
      }
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
      const name = path.split('/').pop();
      return { loader: 'tsx', resolveDir: root, contents: stubs[path] ??
        'export function ' + name + '() { window.rendered.push("' + name + '"); return <p>' + name + '</p>; }' };
    });
  }}],
});
const profile = await mkdtemp(join(tmpdir(), 'teacat-search-check-'));
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
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-search-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
}
