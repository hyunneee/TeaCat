/** Chromium regression checks for auction duration and bid date filters.
 * Run after a development build: node scripts/check-auction-options.mjs.
 * Uses real form, date controls and query hooks; API/auth responses are fixtures.
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
  '@/shared/api': `export const queryClient = {}; export class ApiError extends Error {};
    export const http = {get: async (url, {params}) => {
      window.requests.push({...params});
      if(window.fail) throw new Error('offline');
      if(params.from === '2026-09-01') await new Promise(r => setTimeout(r, 300));
      return {items:[{auctionId:params.from ?? 'all',photocardId:1,designName:'Test photocard',imageUrl:null,myHighestBid:1500,currentPrice:2000,isTopBidder:false,status:'SOLD',endsAt:'2026-09-19T12:00:00',result:'LOST',lastBidAt:'2026-09-18T12:00:00'}],hasNext:!window.layout && !params.cursor,nextCursor:params.cursor?null:'page2'};
    }};`,
  '@/shared/stores': `export const toast = {};`,
  '@/features/auth': `export const useIsLoggedIn = () => true;`,
  '@/features/nft': `export const nftApi = {}; export const nftKeys = {}; export const pocaSeed = () => 1; export const PocaArt = () => <div style={{aspectRatio:'2/3',background:'gray'}}/>;`,
  '@/features/token': `export const tokenKeys = {};`,
  '@/shared/constants': `export const STALE_TIME = {SHORT:0}; export {ROUTES} from ${JSON.stringify(join(root,'src/shared/constants/routes.ts'))};`,
  '@/shared/lib': `export {cn} from ${JSON.stringify(join(root,'src/shared/lib/cn.ts'))}; export {DURATION,EASE} from ${JSON.stringify(join(root,'src/shared/lib/motion.ts'))}; export {parseServerTime} from ${JSON.stringify(join(root,'src/shared/lib/format.ts'))};`,
  '@/shared/components/ui': ['Button','Input','Select','Badge'].map(name => `export {${name}} from ${JSON.stringify(join(root,'src/shared/components/ui/'+name+'.tsx'))};`).join('') + `export {IconButton} from ${JSON.stringify(join(root,'src/shared/components/ui/Button.tsx'))}; export const Logo=()=> <span>TEACAT</span>;`,
  '@/shared/search': `export const SearchEntryButton=()=> <button>Search</button>; export const TrendingSearchInput=()=> <input aria-label="Search"/>;`,
  '@/shared/components/layout': `export {Header} from ${JSON.stringify(join(root,'src/shared/components/layout/Header.tsx'))};`,
  '@/shared/components/common': `export {PageTransition} from ${JSON.stringify(join(root,'src/shared/components/common/PageTransition.tsx'))}; export const Loading=()=> <p>Loading</p>; export const EmptyState=({title})=> <p>{title}</p>;`,
  '@/shared/hooks': ['useScrollTop','useCountdown','useInfiniteScroll'].map(name=> `export {${name}} from ${JSON.stringify(join(root,'src/shared/hooks/'+name+'.ts'))};`).join(''),
  '@/features/auction': `export {useMyBids} from ${JSON.stringify(join(root,'src/features/auction/hooks/useAuction.ts'))}; export {useBidDateFilter} from ${JSON.stringify(join(root,'src/features/auction/hooks/useBidDateFilter.ts'))}; export {BidDateFilters} from ${JSON.stringify(join(root,'src/features/auction/components/BidDateFilters.tsx'))}; export {AuctionCountdown} from ${JSON.stringify(join(root,'src/features/auction/components/AuctionCountdown.tsx'))}; export {MY_BID_RESULT,isRunning,formatBidTime} from ${JSON.stringify(join(root,'src/features/auction/model/auction.model.ts'))};`,
};
const harness = `
import React from 'react';
import {DetailLayout} from './src/shared/components/layout/DetailLayout';
import {MyBidsPage} from './src/pages/MyBidsPage';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {AuctionCreateForm} from './src/features/auction/components/AuctionCreateForm';
import {BidDateFilters} from './src/features/auction/components/BidDateFilters';
import {useBidDateFilter} from './src/features/auction/hooks/useBidDateFilter';
import {useMyBids} from './src/features/auction/hooks/useAuction';
import {resolveDurationMinutes,kstDate,presetBidDates,bidDateError} from './src/features/auction/model/auctionOptions.model';
window.requests=[];window.submissions=[];
function Page(){const filter=useBidDateFilter();const result=useMyBids(filter.dates);window.filter=filter;window.result=result;
 return <><section id="auction"><AuctionCreateForm onSubmit={v=>window.submissions.push(v)}/></section><section id="history"><BidDateFilters {...filter}/><output style={{overflowWrap:"anywhere"}}>{JSON.stringify(result.data)}</output></section></>;}
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const router=createBrowserRouter([{element:<DetailLayout/>,children:[{path:'/layout',element:<MyBidsPage/>}]},{path:'/',element:<Page/>},{path:'/previous',element:<p>Previous page</p>}]);
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(20);}throw new Error('timeout');};
const input=async (el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);};
window.showLayout=async()=>{window.layout=true;document.getElementById('root').className='';await router.navigate('/layout');await until(()=>document.querySelector('main li'));};
window.runChecks=async()=>{
 const results=[];
 for(const [m,valid] of [[29,false],[30,true],[60,true],[360,true],[10080,true],[10081,false]]) assert((resolveDurationMinutes('custom',String(Math.floor(m/60)),String(m%60))===m)===valid,'minute boundary '+m);
 for(const [h,m] of [['','30'],['1',''],['-1','30'],['0','30.5'],['1','60']]) assert(resolveDurationMinutes('custom',h,m)===null,'invalid custom');
 assert(kstDate(new Date('2026-09-18T15:00:00Z'))==='2026-09-19','KST midnight');
 assert(presetBidDates('7',new Date('2026-09-18T15:00:00Z')).from==='2026-09-13','7 days inclusive');
 assert(presetBidDates('30',new Date('2026-09-18T15:00:00Z')).from==='2026-08-21','30 days inclusive');
 assert(bidDateError({from:'2026-02-30',to:'2026-03-01'}),'invalid date');
 results.push('duration boundaries, invalid custom input and Korean date boundaries');
 await until(()=>document.querySelector('#auction input'));
 await input(document.querySelector('#auction input'),'1000');
 const submit=()=>Array.from(document.querySelectorAll('#auction button')).at(-1);
 submit().click();await sleep(30);assert(window.submissions[0]?.durationMinutes===60,'default 60 minutes');
 document.querySelector('#auction button[aria-haspopup]').click();await until(()=>document.querySelectorAll('[role="option"]').length===4);
 document.querySelectorAll('[role="option"]')[3].click();await sleep(30);
 const choose=async(index,value)=>{const field=document.querySelectorAll('#auction select')[index];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,String(value));field.dispatchEvent(new Event('change',{bubbles:true}));await sleep(30);};
 await choose(1,0);assert(document.querySelectorAll('#auction select')[2].value==='30','minimum must be 30 minutes');
 assert(document.querySelectorAll('#auction select')[2].options[29].disabled,'sub-30 choice enabled');
 submit().click();await sleep(30);assert(window.submissions.at(-1).durationMinutes===30,'custom 30');
 await choose(0,7);assert(document.querySelectorAll('#auction select')[1].options.length===1 && document.querySelectorAll('#auction select')[2].options.length===1,'7 day upper bound');
 submit().click();await sleep(30);assert(window.submissions.at(-1).durationMinutes===10080,'custom 7 days');
 document.querySelector('#auction button[aria-haspopup]').click();await until(()=>document.querySelectorAll('[role="option"]').length===4);
 document.querySelectorAll('[role="option"]')[2].click();await sleep(30);submit().click();await sleep(30);assert(window.submissions.at(-1).durationMinutes===360,'preset 6h');
 results.push('real form default, custom validation, preset switching and minute payload');
 await until(()=>window.result.data?.[0]?.auctionId==='all');
 await window.result.fetchNextPage();await until(()=>window.result.data.length===2);
 await router.navigate('/?period=custom&from=2026-09-19&to=2026-09-19');
 await until(()=>window.result.data?.[0]?.auctionId==='2026-09-19');
 assert(window.result.data.length===1,'old pages retained');
 assert(!window.requests.at(-1).cursor,'old cursor reused');
 assert(document.querySelectorAll('#history input')[0].value==='2026-09-19','URL not restored');
 results.push('period URL restoration and pagination reset');
 await router.navigate('/?period=custom&from=2026-09-01&to=2026-09-19');await sleep(30);
 await router.navigate('/?period=custom&from=2026-09-02&to=2026-09-19');await until(()=>window.result.data?.[0]?.auctionId==='2026-09-02');await sleep(350);
 assert(window.result.data[0].auctionId==='2026-09-02','stale response won');
 const count=window.requests.length;
 await router.navigate('/?period=custom&from=2026-09-20&to=2026-09-19');await sleep(50);
 assert(window.filter.error && window.requests.length===count,'invalid period fetched');
 results.push('late responses isolated and invalid periods do not fetch');
 window.fail=true;
 await router.navigate('/?period=custom&from=2026-09-03&to=2026-09-19');await until(()=>window.result.isError);
 window.fail=false;await window.result.refetch();await until(()=>window.result.isSuccess);
 results.push('request failure and retry');
 await router.navigate('/previous');await router.navigate('/');await until(()=>document.querySelector('#history'));
 const historyLength=history.length;
 for(const period of ['today','7','30','custom']) {window.filter.selectPeriod(period);await sleep(30);}
 window.filter.changeDate('from','2026-09-01');await sleep(30);
 assert(history.length===historyLength,'filters pushed browser history');
 await router.navigate(-1);await until(()=>location.pathname==='/previous');
 results.push('filter changes replace history; back returns to previous page');
 await router.navigate('/?period=custom&from=2026-09-01&to=2026-09-19');await until(()=>document.querySelector('#history input'));

 return results;
};
`;

const bundle = await build({
  absWorkingDir: root, stdin: { contents: harness, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'auction-check-boundaries', setup(api) {
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
const profile = await mkdtemp(join(tmpdir(), 'teacat-auction-check-'));
const cssFiles = (await readdir(join(root, 'dist/assets'))).filter(name => name.endsWith('.css'));
const css = (await Promise.all(cssFiles.map(name => readFile(join(root, 'dist/assets', name), 'utf8')))).join('\n');
const server = createServer((req, res) => {
  if (req.url === '/test.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  res.setHeader('Content-Type', req.url === '/test.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/test.js' ? bundle.outputFiles[0].text : '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"><main id="root" class="mx-auto w-full max-w-xl p-4"></main><script src="/test.js"></script>');
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
  for (const width of [360, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:false});
    const layout = await send('Runtime.evaluate', {expression:'document.documentElement.scrollWidth <= innerWidth', returnByValue:true});
    if (!layout.result.result.value) throw new Error('Horizontal overflow at ' + width);
    console.log('PASS styled controls fit ' + width + 'px viewport');
  }
  const opened = await send('Runtime.evaluate', {expression:'window.showLayout()',awaitPromise:true,returnByValue:true});
  if (opened.result.exceptionDetails) throw new Error(JSON.stringify(opened));
  for (const width of [360,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
    const measured = await send('Runtime.evaluate', {expression:`(() => {
      const nav=document.querySelector('.with-topnav > header');
      const row=document.querySelector('main li').getBoundingClientRect();
      const bounds=nav.getBoundingClientRect();
      return {fits:document.documentElement.scrollWidth<=innerWidth,top:row.top,navBottom:bounds.bottom,navVisible:getComputedStyle(nav).display!=='none',main:document.querySelector('.with-topnav > main > div').getBoundingClientRect().width};
    })()`,returnByValue:true});
    const m=measured.result.result.value;
    if(!m.fits || m.navVisible !== (width>=1024) || (width>=1024 && (m.top<m.navBottom || m.main>1024))) throw new Error('Detail layout at '+width+': '+JSON.stringify(m));
    console.log('PASS actual MyBidsPage and DetailLayout at '+width+'px');
  }
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-auction-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
}
