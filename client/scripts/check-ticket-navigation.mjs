/** Real layouts and ticket pages; API/auth/QR payload are fixtures. Run after development build. */
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


const actual=(path,names)=> `export {${names}} from ${JSON.stringify(join(root,'src',path))};`;
const stubs={
 '@/shared/constants': actual('shared/constants/routes.ts','ROUTES'),
 '@/shared/lib': actual('shared/lib/cn.ts','cn')+actual('shared/lib/format.ts','formatDate,formatPrice,formatDateTime,formatRemaining,parseServerTime')+actual('shared/lib/motion.ts','DURATION,EASE,SPRING'),
 '@/shared/components/layout': ['DetailHeader','Header'].map(n=>actual('shared/components/layout/'+n+'.tsx',n)).join(''),
 '@/shared/components/ui': ['Button','Input','Segmented','Badge','Card'].map(n=>actual('shared/components/ui/'+n+'.tsx',n)).join('')+actual('shared/components/ui/Button.tsx','IconButton')+`export const Logo=()=> <span>TEACAT</span>;export const PosterImage=()=> <div/>;`,
 '@/shared/components/common':actual('shared/components/common/PageTransition.tsx','PageTransition')+`export const Loading=()=> <p>Loading</p>;export const PageLoader=Loading;export const EmptyState=({title})=> <p>{title}</p>;`,
 '@/shared/hooks':actual('shared/hooks/useScrollTop.ts','useScrollTop')+actual('shared/hooks/useCountdown.ts','useCountdown'),
 '@/shared/search':`export const SearchEntryButton=()=> <button>Search</button>;export const TrendingSearchInput=()=> <input/>;`,
 '@/app/providers':`export const useModal=()=>({open:(key,props)=>window.dialog={key,props}});`,
 '@/features/auth':`export const useAuth=()=>({user:{faceRegistered:true}});export const can={useTicket:()=>true};`,
 '@/features/ticket':actual('features/ticket/model/ticket.model.ts','isPast,isUsable,isCancelable,nftStatusLabel,seatText,ticketStatusLabel,ticketTone')+actual('features/ticket/components/TicketCard.tsx','TicketCard')+`
 export const useMyTickets=()=>({data:window.tickets,isPending:false});
 export const useTicketDetail=()=>({data:window.tickets[0],isPending:false,isError:false});
 export const useTicketQr=()=>({data:'fixture'});
 export const useCancelTicket=()=>({isPending:false,mutate:()=>{}});
 export const TicketQr=()=> <div data-qr style={{width:200,height:200,background:'#ddd'}}>QR fixture</div>;`,
 '@/features/resale':actual('features/resale/components/ResaleEntryCard.tsx','ResaleEntryCard')+`export const useMyResaleEntries=()=>({data:[],isPending:false});export const useCancelResale=()=>({mutate:()=>{}});`,
};
const harness=`
import React from 'react';import {createRoot} from 'react-dom/client';import {createBrowserRouter,RouterProvider} from 'react-router-dom';
import {AppLayout} from './src/shared/components/layout/AppLayout';
import {DetailLayout} from './src/shared/components/layout/DetailLayout';
import {MyTicketsPage} from './src/pages/MyTicketsPage';
import {MyResalePage} from './src/pages/MyResalePage';
import {TicketDetailPage} from './src/pages/TicketDetailPage';
window.tickets=Array.from({length:30},(_,i)=>({id:String(i+1),orderId:String(i+1),status:'CONFIRMED',concertTitle:'Concert '+i,venueName:'Venue',sectionName:'A',row:1,number:i+1,performanceNum:1,startAt:i===29?'2020-01-01T12:00:00':'2099-01-01T12:00:00',posterUrl:null,nftStatus:'MINTED',price:1000,bookedAt:'2026-09-19T12:00:00'}));
const router=createBrowserRouter([{element:<AppLayout/>,children:[{path:'/',element:<MyTicketsPage/>},{path:'/my/tickets',element:<MyTicketsPage/>},{path:'/my/resale',element:<MyResalePage/>}]},{element:<DetailLayout/>,children:[{path:'/my/tickets/:ticketId',element:<TicketDetailPage/>}]}]);
createRoot(document.getElementById('root')).render(<RouterProvider router={router}/>);
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(ms,300)));
const until=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await sleep(30)}throw new Error('Timed out: '+document.body.innerText.slice(0,500))};
const assert=window.assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
window.ready=async()=>{await router.navigate('/my/tickets');await sleep(100)};
window.checkTickets=async()=>{
 await router.navigate('/my/tickets');await sleep(100);
 assert(document.documentElement.scrollWidth<=innerWidth,'ticket list overflow');
 if(innerWidth>=1024)assert(document.querySelector('.desktop-navigation').getBoundingClientRect().height===65,'subpage must omit main tabs');
 const nav=document.querySelector('[aria-label="내 티켓 메뉴"]');assert(nav,'ticket siblings');
 assert(nav.querySelector('[aria-current="page"]').getAttribute('href')==='/my/tickets','active tickets');
 const index=history.state.idx;
 [...document.querySelectorAll('button')].find(b=>b.textContent==='지난 티켓').click();await sleep(40);
 assert(location.search==='?period=past','period URL');assert(history.state.idx===index,'filter adds history');
 [...document.querySelectorAll('button')].find(b=>b.textContent==='관람 예정').click();await sleep(40);
 await router.navigate('/my/tickets/1');await until(()=>document.querySelector('.ticket-notch')&&document.querySelector('[data-qr]'));
 const card=document.querySelector('.ticket-notch').getBoundingClientRect();const qr=document.querySelector('[data-qr]').getBoundingClientRect();
 assert(document.documentElement.scrollWidth<=innerWidth,'ticket detail overflow');
 if(innerWidth>=1024){assert(qr.left>=card.right,'QR right column');assert(card.top>=document.querySelector('.desktop-navigation').getBoundingClientRect().bottom,'detail behind nav');}
 else assert(qr.top>=card.bottom,'mobile vertical');
 document.querySelector('[aria-label="뒤로 가기"]').click();await until(()=>location.pathname==='/my/tickets');await sleep(60);assert(location.pathname==='/my/tickets','back from detail');
 document.querySelector('[aria-label="내 티켓 메뉴"] a[href="/my/resale"]').click();await sleep(50);assert(location.pathname==='/my/resale','resale link');
 assert(document.querySelector('[aria-label="내 티켓 메뉴"] [aria-current="page"]').getAttribute('href')==='/my/resale','resale active');
 history.back();await until(()=>location.pathname==='/my/tickets');await sleep(70);assert(location.pathname==='/my/tickets','back from sibling');
};
window.checkScroll=async()=>{
 await router.navigate('/');await sleep(80);document.activeElement?.blur();
 const header=()=>document.querySelector('.desktop-navigation');
 const hidden=()=>header().dataset.navHidden==='true';
 scrollTo(0,0);await sleep(220);assert(!hidden(),'top visible');
 const height=document.documentElement.scrollHeight;
 scrollTo(0,300);await sleep(500);assert(hidden(),'down hides tabs');
 assert(document.documentElement.scrollHeight===height,'document height changed');
 const brand=document.querySelector('.navigation-brand').getBoundingClientRect();assert(Math.abs(brand.top)<1,'brand must stay at top');
 const filter=document.querySelector('.under-header').getBoundingClientRect();assert(Math.abs(filter.top-65)<2,'hidden sticky inset '+filter.top);
 assert(header().querySelector('nav').inert,'hidden tabs focusable');
 scrollTo(0,280);await sleep(500);assert(!hidden(),'up reveals tabs');
 assert(Math.abs(document.querySelector('.under-header').getBoundingClientRect().top-109)<2,'visible sticky inset');
 const first=header().querySelector('nav a');first.focus({preventScroll:true});scrollTo(0,400);await sleep(220);assert(!hidden(),'focused menu hidden');first.blur();
 scrollTo(0,450);await sleep(220);assert(hidden(),'down after blur');
 header().querySelector('a').focus({preventScroll:true});await sleep(220);assert(!hidden(),'keyboard reveal '+document.activeElement?.outerHTML+' focused='+document.hasFocus());document.activeElement.blur();
 document.body.style.overflow='hidden';scrollTo(0,550);await sleep(220);assert(!hidden(),'modal lock toggles header');document.body.style.overflow='';
 scrollTo(0,600);await sleep(220);assert(hidden(),'hide before query');
 await router.navigate('/?q=fixture',{replace:true});await sleep(220);assert(hidden(),'query reset visibility');
 scrollTo(0,0);await sleep(220);assert(!hidden(),'return top');
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
const profile = await mkdtemp(join(tmpdir(), 'teacat-ticket-navigation-check-'));
const cssFiles = (await readdir(join(root, 'dist/assets'))).filter(name => name.endsWith('.css'));
const css = (await Promise.all(cssFiles.map(name => readFile(join(root, 'dist/assets', name), 'utf8')))).join('\n');
const server = createServer((req, res) => {
  if (req.url === '/test.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  res.setHeader('Content-Type', req.url === '/test.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/test.js' ? bundle.outputFiles[0].text : '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"><div id="root"></div><script src="/test.js"></script>');
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
  await send('Emulation.setFocusEmulationEnabled', {enabled:true});
  await send('Page.navigate', {url: 'http://127.0.0.1:' + server.address().port + '/'});
  await loaded;
  const evaluate=async(expression)=>{
    const output=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(output.error||output.result.exceptionDetails)throw new Error(JSON.stringify(output));
    return output.result.result.value;
  };
  await evaluate('window.ready()');
  for(const width of [360,768,1023,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    await evaluate('window.checkTickets()');
    console.log('PASS ticket navigation, filters, detail layout at '+width+'px');
  }
  await evaluate('window.checkScroll()');
  console.log('PASS scroll direction, stable document, sticky offset, focus, query navigation, modal lock');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("window.assert(getComputedStyle(document.querySelector('.desktop-navigation')).transitionProperty==='none','reduced motion')");
  console.log('PASS reduced motion');
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-ticket-navigation-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
}
