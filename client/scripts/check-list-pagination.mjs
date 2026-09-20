import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = (path) => JSON.stringify(join(root, 'src', path));
const stubs = {
  '@/shared/api': `export const queryClient = {}; export class ApiError extends Error {};
    export const http = {get: async (url, options={}) => window.getPage(url, options.params ?? {})};`,
  '@/shared/stores': `export const toast = {};`,
  '@/features/auth': `export const useIsLoggedIn=()=>true; export const useAuth=()=>({isLoggedIn:false});`,
  '@/features/token': `export const tokenKeys={}; export const useTokenBalance=()=>({});`,
  '@/app/providers': `export const useModal=()=>({open(){}});`,
  '@/shared/lib': `export {cn} from ${local('shared/lib/cn.ts')}; export {parseServerTime,formatDate,formatDateTime} from ${local('shared/lib/format.ts')}; export const getViewSessionId=()=>''; export const trackGaEvent=()=>{};`,
  '@/shared/constants': `export const STALE_TIME={SHORT:10000,LONG:60000}; export {ROUTES} from ${local('shared/constants/routes.ts')};`,
  '@/shared/components/layout': `export const Header=()=>null;`,
  '@/shared/components/common': `export const Loading=()=> <p>Loading</p>; export const EmptyState=({title})=><p>{title}</p>;`,
  '@/shared/components/ui': `export {IconButton} from ${local('shared/components/ui/Button.tsx')};
    export const Input=({onClear,leftIcon,tone,...props})=><input {...props}/>;
    export const Segmented=({options,value,onChange})=><div>{options.map(o=><button key={o.value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>;
    export const Select=({options,value,onChange,label})=><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>;`,
  '@/features/concert': `export {useConcertPage} from ${local('features/concert/hooks/useConcerts.ts')}; export const ConcertCard=({concert})=><span>{concert.title}</span>;`,
  '@/features/nft': `export {nftApi,nftKeys} from ${local('features/nft/api/nftApi.ts')};
    export {useNftMarketPage} from ${local('features/nft/hooks/useNft.ts')};
    export const DEFAULT_SORT='LATEST'; export const NFT_SORTS=[{value:'LATEST',label:'Latest'},{value:'PRICE_ASC',label:'Price'}];
    export const NftCard=({designName})=><span>{designName}</span>;`,
  '@/features/auction': `export {useAuctionPage} from ${local('features/auction/hooks/useAuction.ts')}; export const DEFAULT_AUCTION_SORT='ENDING_SOON'; export const AUCTION_SORTS=[{value:'ENDING_SOON',label:'Ending'},{value:'LATEST',label:'Latest'}]; export const AuctionCard=({designName})=><span>{designName}</span>;`,
};
const harness = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ConcertListPage} from './src/pages/ConcertListPage';
import {NftMarketPage} from './src/pages/NftMarketPage';
import {useDrawAvailability} from './src/features/nft/hooks/useNft';
import {SectionNavigation} from './src/shared/components/layout/SectionNavigation';
window.requests=[];
window.unlockAt=Date.now()+1500;
window.getPage=async(url,params)=>{
 window.requests.push({url,...params});
 if(url==='/photocards/draw') return Date.now()<window.unlockAt
  ? {available:false,remaining:0,scheduled:2,nextOpenAt:new Date(window.unlockAt).toISOString()}
  : {available:true,remaining:1,scheduled:1,nextOpenAt:null};
 if(window.fail) throw Error('offline');
 const second=params.cursor!=null;
 const items=Array.from({length:second?3:params.size},(_,i)=>({concertId:i,photocardId:i,auctionId:i,title:'Concert '+(second?100+i:i),designName:'Card '+(second?100+i:i)}));
 return {...(url==='/concerts'?{concerts:items}:{items}),hasNext:!second,nextCursor:second?null:url==='/concerts'?20:'next'};
};
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
const root=createRoot(document.getElementById('root'));
const render=(node,path='/')=>root.render(<QueryClientProvider client={queryClient}><MemoryRouter key={path} initialEntries={[path]}>{node}</MemoryRouter></QueryClientProvider>);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn)=>{for(let i=0;i<150;i++){if(fn())return;await sleep(30);}throw Error('Timed out: '+fn);};
const assert=(value,message)=>{if(!value)throw Error(message);};
const button=label=>document.querySelector('button[aria-label="'+label+'"]');
const textButton=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
const change=async(selector,value)=>{const node=document.querySelector(selector);Object.getOwnPropertyDescriptor(node.tagName==='INPUT'?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event(node.tagName==='INPUT'?'input':'change',{bubbles:true}));await sleep(40);};
function Packs(){const result=useDrawAvailability();return <p id="pack">{result.data?.remaining}</p>;}
window.runChecks=async()=>{
 const results=[];
 render(<ConcertListPage/>);
 await until(()=>document.querySelectorAll('li').length===20);
 assert(window.requests.at(-1).size===20,'concert request size');
 button('다음 페이지').click();await until(()=>document.querySelectorAll('li').length===3);
 assert(window.requests.at(-1).cursor===20,'concert cursor');
 assert(button('다음 페이지').disabled,'last page next');
 button('이전 페이지').click();await until(()=>document.querySelectorAll('li').length===20);
 button('다음 페이지').click();await until(()=>document.querySelectorAll('li').length===3);
 textButton('지난 공연').click();await until(()=>document.querySelectorAll('li').length===20);
 assert(window.requests.at(-1).past===true && window.requests.at(-1).cursor==null,'tab reset');
 results.push('concert 20 items, next/previous, final page and tab reset');
 render(<NftMarketPage/>,'/nft');await until(()=>document.querySelectorAll('li').length===25);
 assert(!window.requests.some(r=>r.url==='/nft-market/auctions'),'inactive auctions fetched');
 button('다음 페이지').click();await until(()=>document.querySelectorAll('li').length===3);
 await change('input','new');await until(()=>document.querySelectorAll('li').length===25);
 assert(window.requests.at(-1).keyword==='new' && window.requests.at(-1).cursor==null,'keyword reset');
 button('다음 페이지').click();await until(()=>document.querySelectorAll('li').length===3);
 await change('select','PRICE_ASC');await until(()=>document.querySelectorAll('li').length===25);
 assert(window.requests.at(-1).cursor==null,'sort reset');
 textButton('경매').click();await until(()=>window.requests.some(r=>r.url==='/nft-market/auctions'));
 await until(()=>document.querySelectorAll('li').length===25);
 button('다음 페이지').click();await until(()=>document.querySelectorAll('li').length===3);
 const count=window.requests.length;await sleep(5300);
 const polls=window.requests.slice(count);assert(polls.length>0 && polls.every(r=>r.url==='/nft-market/auctions' && r.cursor==='next' && r.size===25),'poll only visible page');
 textButton('상점').click();await until(()=>document.querySelectorAll('li').length===25);
 const auctionCount=window.requests.filter(r=>r.url==='/nft-market/auctions').length;await sleep(5300);
 assert(window.requests.filter(r=>r.url==='/nft-market/auctions').length===auctionCount,'hidden auction polling');
 results.push('market 25 items, search/sort reset, visible-page polling and inactive-tab pause');
 window.fail=true;await change('input','error');await until(()=>textButton('목록을 불러오지 못했어요. 다시 시도'));
 window.fail=false;textButton('목록을 불러오지 못했어요. 다시 시도').click();await until(()=>document.querySelectorAll('li').length===25);
 results.push('request error and retry');
 render(<SectionNavigation/>,'/concerts/1?preview=1');await sleep(80);assert(!document.querySelector('nav'),'preview navigation');
 render(<SectionNavigation/>,'/concerts/1');await until(()=>document.querySelector('nav'));
 results.push('preview hides section tabs; normal detail retains them');
 window.unlockAt=Date.now()+1500;render(<Packs/>,'/packs');await until(()=>document.querySelector('#pack')?.textContent==='0');
 await until(()=>document.querySelector('#pack')?.textContent==='1');results.push('scheduled pack becomes available without reload');
 return results;
};
`;
const bundle = await build({absWorkingDir:root,stdin:{contents:harness,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},
  plugins:[{name:'fixtures',setup(api){
    api.onResolve({filter:/.*/},({path})=>{
      if(path in stubs)return {path,namespace:'fixture'};
      if(path.startsWith('@/')){const p=join(root,'src',path.slice(2));return {path:existsSync(p+'.ts')?p+'.ts':existsSync(p+'.tsx')?p+'.tsx':join(p,'index.ts')};}
    });
    api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:stubs[path],loader:'tsx',resolveDir:root}));
  }}]});
const profile=await mkdtemp(join(tmpdir(),'teacat-pagination-'));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/test.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browserPath=[process.env.BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
if(!browserPath)throw Error('Chrome or Edge required');
const browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
try {
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  if(!port)throw Error('Browser startup timed out');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')console.error(JSON.stringify(m.params));if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);socket.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');
  await send('Page.enable');
  const loaded=new Promise(r=>socket.addEventListener('message',({data})=>{if(JSON.parse(data).method==='Page.loadEventFired')r();}));
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
  await loaded;
  const output=await send('Runtime.evaluate',{expression:'window.runChecks()',awaitPromise:true,returnByValue:true});
  if(output.error||output.result.exceptionDetails)throw Error(JSON.stringify(output));
  output.result.result.value.forEach(name=>console.log('PASS '+name));
  await send('Browser.close');
} finally {
  socket?.close();browser.kill();server.close();
  if(dirname(resolve(profile))!==resolve(tmpdir())||!profile.includes('teacat-pagination-'))throw Error('Unexpected profile path');
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
