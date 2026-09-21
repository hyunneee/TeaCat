/** Chromium regression checks for photocard desktop and shared trade panels.
 * Run after a development build: node scripts/check-poca-detail.mjs.
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

const actual=(path,names)=> `export {${names}} from ${JSON.stringify(join(root,'src',path))};`;
const stubs={
 '@/shared/api': `export class ApiError extends Error {static isApiError(){return false}};export const newIdempotencyKey=()=> 'fixture-key';`,
 '@/shared/constants': actual('shared/constants/routes.ts','ROUTES'),
 '@/shared/lib': actual('shared/lib/cn.ts','cn')+actual('shared/lib/format.ts','formatDate,formatDateTime,formatRemaining,parseServerTime')+actual('shared/lib/motion.ts','DURATION,EASE,SPRING'),
 '@/shared/components/layout': ['DetailLayout','DetailHeader','Header','BottomBar'].map(n=>actual('shared/components/layout/'+n+'.tsx',n)).join(''),
 '@/shared/components/ui': ['Button','Input','Select','Badge','SectionTitle','Textarea','Segmented','Card'].map(n=>actual('shared/components/ui/'+n+'.tsx',n)).join('')+actual('shared/components/ui/Button.tsx','IconButton')+`export const Logo=()=> <span>TEACAT</span>;`,
 '@/shared/components/common':actual('shared/components/common/PageTransition.tsx','PageTransition')+`export const Loading=()=> <p>Loading</p>;export const PageLoader=Loading;export const EmptyState=({title})=> <p>{title}</p>;`,
 '@/shared/hooks':['useScrollTop','useCountdown','useInfiniteScroll'].map(n=>actual('shared/hooks/'+n+'.ts',n)).join(''),
 '@/shared/search':`export const SearchEntryButton=()=> <button>Search</button>;export const TrendingSearchInput=()=> <input/>;`,
 '@/app/providers':`export const useModal=()=>({open:(key,props)=>window.dialog={key,props}});`,
 '@/features/auth':`export const useAuth=()=>({user:window.user});`,
 '@/features/token':`export const useTokenBalance=()=>({data:{available:window.balance}});`,
 '@/features/nft': ['PhotocardDetailLayout','PhotocardInfo','FixedPricePanel'].map(n=>actual('features/nft/components/'+n+'.tsx',n)).join('')+actual('features/nft/components/PocaCopyList.tsx','PocaCopyList,PocaCopyPicker')+actual('features/nft/model/nft.model.ts','formatOrigin,isOwner,sellableCopies,mintStatusLabel,photocardSource,pocaName,pocaSeed')+actual('features/nft/model/pocaDraw.model.ts','isSpecial')+`
 export const PocaShowcase=({className})=><div className={className} style={{aspectRatio:'2/3',background:'gray'}}/>;
 export const PocaArt=PocaShowcase;export const PocaLiveCard=PocaShowcase;export const PocaSpotlight=()=>null;
 export const usePhotocardDetail=()=>({data:window.card,isPending:false,isError:false});
 export const useRecordPhotocardView=()=>{};
 export const useMyDesignCopies=(id)=>({data:id?window.copies:[]});
 export const useMyTrades=()=>({trades:[window.saleRow],isPending:false,hasNextPage:false,isFetchingNextPage:false,fetchNextPage:()=>{}});export const useMySales=()=>({data:[window.saleRow],isPending:false,hasNextPage:false,isFetchingNextPage:false,fetchNextPage:()=>{}});
 export const usePurchasePhotocard=()=>({isPending:window.pending,mutate:v=>window.purchase=v});
 export const useListPhotocard=()=>({isPending:window.pending,mutate:v=>window.sale=v});
 export const useUnlistPhotocard=()=>({isPending:window.pending,mutate:v=>window.unlist=v});`,
 '@/features/auction':actual('features/auction/components/AuctionCountdown.tsx','AuctionCountdown')+actual('features/auction/model/auction.model.ts','MY_AUCTION_FILTERS,AUCTION_STATUS_LABEL,isRunning')+actual('features/auction/components/AuctionTradePanel.tsx','AuctionTradePanel')+actual('features/auction/components/AuctionCreateForm.tsx','AuctionCreateForm')+`export const useMyAuctions=()=>({data:[{...window.card,...window.trade.auction}],isPending:false,hasNextPage:false,isFetchingNextPage:false,fetchNextPage:()=>{}});export const useAuctionTrade=()=>window.trade;export const useCreateAuction=id=>({isPending:false,mutate:v=>window.created={id,...v}});`,
 '@/features/inquiry': actual('features/inquiry/model/inquiry.model.ts','CONTENT_MAX_LENGTH,EMPTY_INQUIRY_FORM,INQUIRY_TYPES,TITLE_MAX_LENGTH,TYPE_DESCRIPTION,TYPE_LABEL,STATUS_LABEL,STATUS_TONE,isInquiryValid,validateInquiry')+`export const useMyInquiries=()=>({data:{inquiries:[window.inquiry],totalPages:1},isPending:false,page:0,setPage:()=>{}});export const useInquiry=()=>({data:window.inquiry,isPending:false,isError:false});export const useCreateInquiry=()=>({isPending:false,mutate:()=>{}});export const useUpdateInquiry=useCreateInquiry;export const useDeleteInquiry=useCreateInquiry;`,
 '@/features/resale': actual('features/resale/components/ResaleEntryCard.tsx','ResaleEntryCard')+`export const useMyResaleEntries=()=>({data:[{id:'1',status:'WAITING',concertTitle:'Concert',startAt:'2026-09-19T12:00:00',sectionName:'A',quantity:1,price:10000}],isPending:false});export const useCancelResale=()=>({mutate:()=>{}});`,

};
const harness=`
import React from 'react';import {createRoot} from 'react-dom/client';import {createBrowserRouter,RouterProvider} from 'react-router-dom';
import {DetailLayout} from './src/shared/components/layout/DetailLayout';
import {MyAuctionsPage} from './src/pages/MyAuctionsPage';
import {NftTradesPage} from './src/pages/NftTradesPage';
import {NftSalesPage} from './src/pages/NftSalesPage';
import {MyResalePage} from './src/pages/MyResalePage';
import {InquiryListPage} from './src/pages/InquiryListPage';
import {InquiryWritePage} from './src/pages/InquiryWritePage';
import {InquiryDetailPage} from './src/pages/InquiryDetailPage';
import {NftDetailPage} from './src/pages/NftDetailPage';
import {AuctionDetailPage} from './src/pages/AuctionDetailPage';
import {buildPocaDex,filterOwnedCards} from './src/features/nft/model/pocaDex.model';
import {nextLockedOpenAt,groupLockedPacks} from './src/features/nft/model/nft.model';
window.pending=false;window.balance=10000;window.user={nickname:'viewer'};
const base={photocardId:1,designId:1,designName:'Long photocard name',imageUrl:null,performanceTitle:null,ownerNickname:'seller',issuedAt:'2026-09-19T12:00:00',origin:null,status:'MINTED',listing:{price:1000,status:'ACTIVE'},auction:null,isMine:false};
const copy=id=>({photocardId:id,issuedAt:base.issuedAt,status:'MINTED',marketType:null,origin:null,performanceNum:null,performanceDate:null});
window.copies=[copy(1),copy(2)];window.card={...base};
const auction={auctionId:1,photocard:base,status:'ACTIVE',endsAt:'2099-01-01T00:00:00',startPrice:1000,currentPrice:1500,buyNowPrice:5000,bidCount:1,sellerNickname:'seller',viewer:{isSeller:false,isTopBidder:false}};
window.trade={auction,isPending:false,isError:false,refetch:()=>{},bids:{data:[],hasNextPage:false,isFetchingNextPage:false,fetchNextPage:()=>{},refetch:()=>{}},token:{available:10000},placeBid:()=>{},bidding:false,buyNow:{isPending:false,mutate:()=>window.bought=true},cancel:{isPending:false,mutate:()=>window.cancelled=true},handleEnd:()=>{},navigate:(...v)=>window.navigation=v,location:{pathname:'/nft/1'}};
window.saleRow={tradeId:1,photocardId:1,designName:'Photocard',imageUrl:null,type:'BUY',tradedAt:'2026-09-19T12:00:00',price:1000,buyerNickname:'buyer',counterpartyNickname:'seller'};window.inquiry={inquiryId:1,type:'BUG',status:'OPEN',title:'Question',content:'Question body',createdAt:'2026-09-19T12:00:00',answer:null};
let revision=0;
const root=createRoot(document.getElementById('root'));
let router;
const render=()=>{router?.dispose();router=createBrowserRouter([{element:<DetailLayout/>,children:[{path:'/login',element:<p>Login</p>},{path:'/nft/:photocardId',element:<NftDetailPage key={revision++}/>},{path:'/auction/:auctionId',element:<AuctionDetailPage/>},{path:'/fixture/MyAuctionsPage',element:<MyAuctionsPage/>},{path:'/fixture/NftTradesPage',element:<NftTradesPage/>},{path:'/fixture/NftSalesPage',element:<NftSalesPage/>},{path:'/fixture/MyResalePage',element:<MyResalePage/>},{path:'/fixture/InquiryListPage',element:<InquiryListPage/>},{path:'/fixture/InquiryWritePage',element:<InquiryWritePage/>},{path:'/fixture/InquiryDetailPage',element:<InquiryDetailPage/>}]}]);root.render(<RouterProvider key={revision} router={router}/>);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(20)}throw new Error('timeout: '+document.body.innerText.slice(0,1200))};
window.setScenario=async(name)=>{
 window.card={...base};window.user={nickname:'viewer'};window.copies=[];window.pending=false;window.balance=10000;window.dialog=null;
 window.trade.auction={...auction,viewer:{...auction.viewer}};window.trade.token.available=10000;
 if(name==='owner'||name==='owner-legacy'){window.card.isMine=name==='owner'?true:undefined;window.card.ownerNickname='old-nickname';window.card.listing=null;window.copies=[copy(1),copy(2)];}
 if(name==='guest')window.user=null;
 if(name==='poor')window.balance=0;
 if(name==='pending')window.pending=true;
 if(name==='settling')window.card.listing={...base.listing,status:'SETTLING'};
 if(name==='failed'){window.card.isMine=true;window.card.listing=null;window.card.status='FAILED';}
 if(name.startsWith('auction')){window.card.auction={auctionId:1,status:'ACTIVE'};window.card.listing=null;
  if(name==='auction-seller')window.trade.auction.viewer={isSeller:true};
  if(name==='auction-guest')window.trade.auction.viewer=null;
  if(name==='auction-top')window.trade.auction.viewer={isSeller:false,isTopBidder:true};
  if(name==='auction-settling')window.trade.auction.status='SETTLING';
  if(name==='auction-ended')window.trade.auction.status='EXPIRED';
  if(name==='auction-poor')window.trade.token.available=0;
 }
 history.replaceState(null,'','/nft/1');render();await sleep(70);await until(()=>document.querySelector('[data-photocard-panel]'));
};
const actionButtons=()=>[...document.querySelectorAll('[data-photocard-panel] .fixed button')];
window.runChecks=async()=>{
 const results=[];
 /* 도감은 서버가 센 요약(count·대표 카드)을 풀 위에 얹는다. 풀 밖 보유 카드는 별도 목록("보유 카드만")이 맡는다 */
 const pool=[{designId:5,name:'Owned',imageUrl:null,group:null,grade:null},{designId:6,name:'Missing',imageUrl:null,group:null,grade:null}];
 const dex=buildPocaDex(pool,[{designId:5,count:2,marketCount:0,marketState:null,photocardId:11}]);
 assert(dex.length===2&&dex[0].count===2&&dex[0].photocardId===11,'dex must take count and representative card from the summary');
 assert(dex[1].count===0&&dex[1].photocardId===null,'designs not owned stay as empty slots');
 const ownedCard={photocardId:11,designId:9,designName:'Outside pool',imageUrl:null,status:'MINTED',listed:false};
 assert(filterOwnedCards([ownedCard,{...ownedCard,photocardId:12}],{}).length===2,'owned cards outside the draw pool remain in the owned-only list');
 results.push('dex from summary; owned cards outside draw pool stay in owned-only list');
 const pk=(packId,openAt,openable)=>({packId,source:'TICKET_PURCHASE',title:'Concert',openAt,openable});
 const late='2026-10-08T18:50:00',soon='2026-10-01T18:50:00';
 const drawStatus={available:true,remaining:1,scheduled:3,nextOpenAt:soon,packs:[pk(1,null,true),pk(2,soon,false),pk(3,soon,false),pk(4,late,false)]};
 assert(nextLockedOpenAt(drawStatus)===soon,'earliest locked pack decides the next refresh');
 const groups=groupLockedPacks(drawStatus);
 assert(groups.length===2&&groups[0].openAt===soon&&groups[0].count===2&&groups[1].count===1,'locked packs grouped per open time');
 assert(groupLockedPacks({...drawStatus,scheduled:9})===null,'truncated pack list must not be grouped');
 assert(groupLockedPacks({available:true,remaining:1,scheduled:1,nextOpenAt:soon})===null&&nextLockedOpenAt({available:true,remaining:0,scheduled:1,nextOpenAt:soon})===soon,'old server without packs falls back');
 assert(nextLockedOpenAt({...drawStatus,packs:[pk(1,null,true)],scheduled:0})===null,'no locked pack, no timer');
 results.push('per-pack open time: next refresh, grouping and old-server fallback');
 await window.setScenario('owner-legacy');assert(actionButtons().length===1&&!actionButtons()[0].disabled,'authenticated copies recover missing isMine');
 results.push('ownership recovered from authenticated copies');
 await window.setScenario('fixed');assert(actionButtons().length===1&&!actionButtons()[0].disabled,'fixed purchase CTA');actionButtons()[0].click();assert(window.dialog?.key==='common/confirm','purchase confirmation');window.dialog.props.onConfirm();assert(window.purchase.photocardId===1,'purchase target');
 await window.setScenario('guest');assert(!actionButtons()[0].disabled,'guest login CTA');actionButtons()[0].click();await sleep(20);assert(router.state.location.pathname==='/login','guest login navigation');
 await window.setScenario('poor');assert(actionButtons()[0].disabled,'insufficient balance');
 await window.setScenario('pending');assert(actionButtons()[0].disabled,'pending duplicate submission');
 await window.setScenario('settling');assert(actionButtons().length===0,'settlement must block purchase');
 await window.setScenario('failed');assert(actionButtons()[0].disabled,'failed mint sale');
 results.push('fixed purchase, guest login, balance, pending and mint/settlement states');
 await window.setScenario('owner');actionButtons()[0].click();await until(()=>document.querySelector('[role=radio]'));
 document.querySelectorAll('[role=radio]')[1].click();await sleep(20);
 const field=document.querySelector('[data-photocard-panel] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'2500');field.dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);
 const saleButton=[...document.querySelectorAll('[data-photocard-panel] button')].find(b=>b.textContent==='\ud310\ub9e4 \ub4f1\ub85d\ud558\uae30');assert(saleButton&&!saleButton.disabled,'sale form');saleButton.click();assert(window.sale.photocardId===2,'selected copy must be sold');
 results.push('server ownership survives nickname change; selected copy submitted');
 for(const name of ['auction','auction-guest','auction-seller','auction-top','auction-settling','auction-ended']){
  await window.setScenario(name);
  if(name.endsWith('settling')||name.endsWith('ended'))assert(actionButtons().length===0,'closed auction CTA');
  else if(name.endsWith('seller'))assert(actionButtons().length===0,'seller with bids cancellation');
  else if(name.endsWith('top'))assert(actionButtons()[0].disabled,'top bidder cannot bid');
  else assert(actionButtons().length>0,'auction actions missing');
 }
 await window.setScenario('auction');actionButtons()[0].click();assert(window.dialog?.key==='auction/bid','shared bid action');assert(window.dialog.props.min===1501,'latest bid minimum');
 await window.setScenario('auction-poor');assert(actionButtons().every(b=>b.disabled),'auction insufficient balance');
 await window.setScenario('auction');window.trade.auction.currentPrice=2000;render();await sleep(70);actionButtons()[0].click();assert(window.dialog.props.min===2001,'changed current price bid minimum');
 results.push('shared auction panel roles, settlement/end, balance and changed bid minimum');
 await router.navigate('/auction/1');await sleep(60);assert(document.querySelector('[data-photocard-panel]'),'standalone auction panel');
 results.push('standalone auction detail reuses panel');
 await window.setScenario('fixed');return results;
};
window.checkHistoryPages=async()=>{
 for(const name of ['MyAuctionsPage','NftTradesPage','NftSalesPage','MyResalePage','InquiryListPage','InquiryWritePage','InquiryDetailPage']){
  await router.navigate('/fixture/'+name);await sleep(70);
  assert(document.querySelector('.with-topnav > main header'),'missing header '+name);
  assert(document.documentElement.scrollWidth<=innerWidth,'overflow '+name);
  const title=document.querySelector('.with-topnav > main header').getBoundingClientRect();
  assert(innerWidth<1024||title.height===0,'mobile header visible on desktop '+name);
  if(name==='InquiryWritePage') assert(document.querySelector('form').getBoundingClientRect().width<=768,'form too wide');
 }
};
window.measureLayout=async()=>{
 const image=document.querySelector('[data-photocard-image]').getBoundingClientRect();const panel=document.querySelector('[data-photocard-panel]').getBoundingClientRect();const bar=document.querySelector('[data-photocard-panel] .fixed');const nav=document.querySelector('.with-topnav > header');
 assert(document.documentElement.scrollWidth<=innerWidth,'horizontal overflow');assert(document.querySelectorAll('[data-photocard-panel] .fixed').length===1,'duplicate CTA');
 if(innerWidth>=1024){assert(getComputedStyle(document.querySelector('[aria-label="주요 메뉴"]')).display!=='none','main navigation hidden');assert(!document.querySelector('[aria-label="포카 메뉴"]'),'redundant photocard navigation');assert(image.right<=panel.left+1,'desktop columns overlap');assert(image.top>=nav.getBoundingClientRect().bottom,'image behind nav');assert(getComputedStyle(bar).position==='static','desktop CTA fixed');const br=bar.getBoundingClientRect();assert(br.left>=panel.left-1 && br.right<=panel.right+1,'CTA outside trade column');}
 else{assert(panel.top>=image.bottom-1,'mobile must be vertical');assert(getComputedStyle(bar).position==='fixed','mobile CTA not fixed');}
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
const profile = await mkdtemp(join(tmpdir(), 'teacat-poca-detail-check-'));
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
  await send('Page.navigate', {url: 'http://127.0.0.1:' + server.address().port + '/'});
  await loaded;
  const output = await send('Runtime.evaluate', {expression: 'window.runChecks()', awaitPromise:true, returnByValue:true});
  if (output.error || output.result.exceptionDetails) throw new Error(JSON.stringify(output));
  for (const name of output.result.result.value) console.log('PASS ' + name);
  for (const width of [360,767,768,1023,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const geometry=await send('Runtime.evaluate',{expression:'window.measureLayout()',awaitPromise:true,returnByValue:true});
    if(geometry.result.exceptionDetails) throw new Error(JSON.stringify(geometry));
    console.log('PASS photocard layout, navigation and single responsive CTA at '+width+'px');
  }
  for(const width of [360,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const result=await send('Runtime.evaluate',{expression:'window.checkHistoryPages()',awaitPromise:true,returnByValue:true});
    if(result.result.exceptionDetails)throw new Error(JSON.stringify(result));
    console.log('PASS seven history/inquiry pages at '+width+'px');
  }
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); server.close();
  // 이 실행이 mkdtemp로 생성한 독립 프로필만 정리한다.
  const expectedRoot = resolve(tmpdir());
  if (dirname(resolve(profile)) !== expectedRoot || !profile.includes('teacat-poca-detail-check-')) {
    throw new Error('Unexpected temporary profile path');
  }
  await rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
}
