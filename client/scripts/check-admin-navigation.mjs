import { build } from 'esbuild';
import { resolve } from 'node:path';

// 실제 사이드바와 권한 함수를 SSR하여 역할별 메뉴를 검증한다. API는 호출하지 않는다.
const root = process.cwd();
const source = `
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {AdminSidebar} from './src/features/admin/components/AdminSidebar';
export {useStadiumEditorStore} from './src/features/stadium/store/stadiumEditorStore';
export function render(role) {return renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/concerts/1']}><AdminSidebar user={{role}}/></MemoryRouter>)};
`;
const result = await build({
  stdin: { contents: source, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
  plugins: [{name:'boundaries',setup(api){
    api.onResolve({filter:/^@\//},({path})=>({path,namespace:'fixture'}));
    api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>{
      const exports = {
        '@/features/auth': `export {can} from ${JSON.stringify(resolve(root,'src/features/auth/model/permission.ts'))};`,
        '@/shared/constants': `export {ROUTES} from ${JSON.stringify(resolve(root,'src/shared/constants/routes.ts'))}; export const FEATURE={face:true};`,
        '@/shared/lib': `export {cn} from ${JSON.stringify(resolve(root,'src/shared/lib/cn.ts'))};`,
        '@/shared/components/ui': 'export const Logo=()=>null;',
      };
      if (!(path in exports)) throw new Error(path);
      return {contents:exports[path],loader:'tsx',resolveDir:root};
    });
  }}],
});
const {createRequire}=await import('node:module');
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const assert=(value,message)=>{if(!value)throw new Error(message)};
const store=module.exports.useStadiumEditorStore;
const area=(clientId,sourceSheet='1F')=>({clientId,sourceSheet,areaCode:clientId});
store.setState({areas:[area('front'),area('upper','2F'),area('middle'),area('back')],selectedAreaId:'middle'});
const order=()=>store.getState().areas.map(area=>area.clientId).join(',');
store.getState().moveArea('back',-1);
assert(order()==='front,upper,back,middle','move up preserves other sheets');
assert(store.getState().selectedAreaId==='middle','move preserves selection');
store.getState().moveArea('back',1);
assert(order()==='front,upper,middle,back','move down restores order');
store.getState().moveArea('front',-1);
store.getState().moveArea('back',1);
store.getState().moveArea('missing',1);
assert(order()==='front,upper,middle,back','boundary and missing area moves are ignored');
console.log('PASS stadium area reordering');
for(const role of ['ADMIN','PERFORMANCE','STADIUM']){
  const html=module.exports.render(role);
  assert(html.includes('운영 메뉴'),role+' navigation');
  assert(html.includes('href="/admin/poca-templates"')===(role==='ADMIN'),role+' poca permission');
  assert(html.includes('href="/admin/monitoring"')===(role==='ADMIN'),role+' monitoring permission');
  assert(html.includes('href="/admin/concerts"')===(role!=='STADIUM'),role+' concerts permission');
  assert(html.includes('href="/admin/stadiums"')===(role!=='PERFORMANCE'),role+' stadium permission');
  assert(html.includes('포카 콘텐츠')===(role==='ADMIN'),role+' empty group');
  assert(html.includes('href="/admin/check-in"')===(role!=='STADIUM'),role+' check-in permission');
  if(role==='ADMIN') {
    const groups=['개요','회원·고객 지원','공연 운영','공연장 관리','서비스 콘텐츠','포카 콘텐츠'];
    const positions=groups.map(label=>html.indexOf('aria-label="'+label+'"'));
    assert(positions.every((position,index)=>position>=0 && (index===0 || position>positions[index-1])), 'group order');
  }
  console.log('PASS '+role+' grouped navigation and permissions');
}
