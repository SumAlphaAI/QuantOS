import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadCurrentPre02, validatePre02 } from '../../../../packages/ui/scripts/pre02-checks.mjs';
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../../..');
const current = loadCurrentPre02();
const probes=[];
function mutation(id, description, change) {
 const input=structuredClone(current); change(input);
 const result=validatePre02(input);
 probes.push({id,description,status:result.status,failures:result.failures});
}
mutation('state-deny-success','风险 deny 被映射为成功色',x=>x.tokens.stateColor.deny='semantic.success');
mutation('state-invalid-path','风险 deny 映射到不存在的 token',x=>x.tokens.stateColor.deny='semantic.nonexistent');
mutation('english-inverted','英文危险语义反转但保持 key 非空',x=>x.en['safety.nonExecutableProposal']='This is an executable order. Submit it now.');
mutation('density-broken','compact 控件高/padding 破坏',x=>{x.tokens.density.compact.controlHeight=0;x.tokens.density.compact.padding=-12;});
mutation('focus-broken','焦点环宽度清零并改为低对比度 token',x=>{x.tokens.focus.ringWidth=0;x.tokens.focus.ringColorToken='border.default';});
mutation('breakpoint-gap','折叠上界改为 800，造成区间缺口',x=>x.tokens.breakpoints.collapsed.max=800);
mutation('typography-broken','正文排版和基栅破坏',x=>{x.tokens.typography.body.fontSize='1px';x.tokens.spacing.base=3;});
mutation('inventory-replaced','用任意名称替换危险确认组件，保持行数',x=>x.componentInventory=x.componentInventory.replace('Dialog / DangerConfirmDialog','UnrelatedPlaceholder'));
mutation('storybook-comment-only','插件/扫描/视口/story 只留注释，不留可执行配置',x=>{x.storybookMain=x.storybookMain.split('\n').map(line=>'// '+line).join('\n');x.storybookPreview=x.storybookPreview.split('\n').map(line=>'// '+line).join('\n');x.stateBadgeStories=x.stateBadgeStories.split('\n').map(line=>'// '+line).join('\n');});
mutation('surface2-broken','浮层背景改为与文字同色，未进入 36 对比度矩阵',x=>x.tokens.color.dark.surface['2']=x.tokens.color.dark.text.primary);
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
function luminance(hex){const rgb=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)/255));return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function ratio(a,b){const x=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (x[0]+.05)/(x[1]+.05);}
const contrast=[];
for(const [theme,p] of Object.entries(current.tokens.color)) {
 contrast.push({pair:`${theme} input border.strong/surface.0`,ratio:ratio(p.border.strong,p.surface['0']),minimum:3,context:'q-input border/background; component boundary, needs sufficient alternative visual identification'});
 contrast.push({pair:`${theme} input border.strong/surface.1`,ratio:ratio(p.border.strong,p.surface['1']),minimum:3,context:'q-input on panel/dialog'});
 for(const [name,color] of Object.entries(p.chart)) if(Array.isArray(color)) for(let i=0;i<color.length;i++) contrast.push({pair:`${theme} categorical[${i}]/surface.0`,ratio:ratio(color[i],p.surface['0']),minimum:3});
}
const require=createRequire(resolve(root,'packages/ui/package.json'));
const viteRequire=createRequire(require.resolve('vite'));
const { build }=await import(viteRequire.resolve('esbuild'));
let sourceModule;
async function loadSource() {
 if(sourceModule) return sourceModule;
 const result=await build({entryPoints:[resolve(root,"packages/ui/src/index.ts")],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-dom'],logLevel:'silent'});
 const module={exports:{}};
 new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
 sourceModule = module.exports; return sourceModule;
}
const { renderToStaticMarkup }=require('react-dom/server');
const React=require('react');
const runtime=[];
{
 const { StateBadge }=await loadSource('packages/ui/src/components/StateBadge/StateBadge.tsx');
 for(const state of ['running','some_future_enum','toString','constructor','__proto__']) {
  try { const markup=renderToStaticMarkup(React.createElement(StateBadge,{state}));runtime.push({state,status:'RENDERED',markup}); }
  catch(error) {runtime.push({state,status:'THREW',error:error.message});}
 }
 const { ThemeProvider }=await loadSource('packages/ui/src/theme/ThemeProvider.tsx');
 const { I18nProvider }=await loadSource('packages/ui/src/i18n/I18nProvider.tsx');
 const markup=renderToStaticMarkup(React.createElement(ThemeProvider,{theme:'light'},React.createElement(I18nProvider,{locale:'en'},React.createElement(StateBadge,{state:'some_future_enum'}))));
 runtime.push({state:'some_future_enum under light/en providers',status:'RENDERED',markup});
 const light=current.tokens.color.light;
 const dark=current.tokens.color.dark;
 const defaultMarkup=renderToStaticMarkup(React.createElement(ThemeProvider,{theme:'light'},React.createElement(StateBadge,{state:'running'})));
 const foreground=defaultMarkup.match(/gap:[^;]+;color:(#[0-9A-Fa-f]+);/)[1];
 contrast.push({pair:'Storybook toolbar light: default StateBadge running / light surface.0',ratio:ratio(foreground,light.surface['0']),minimum:4.5,foreground,background:light.surface['0'],basis:'Effective provider-inherited foreground from rendered StateBadge markup against light surface.0',markup:defaultMarkup});
}
const report={schema:'quantos-pre02-remediation-probes/v1',baseline:readFileSync(resolve(output,'baseline.txt'),'utf8').trim(),original_gate:validatePre02(current).status,mutations:probes,contrast,runtime,browser_execution:'NOT_RUN',note:'Mutation PASS means the existing gate accepts deliberately broken input. SSR is not browser/axe acceptance.'};
if(probes.some(p=>p.status!=='FAIL') || runtime.some(p=>p.status==='THREW') || contrast.some(p=>p.ratio<p.minimum)) throw new Error('PRE-02 remediation verification failed');
writeFileSync(resolve(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({original:report.original_gate,accepted_broken_inputs:probes.filter(p=>p.status==='PASS').length,total_mutations:probes.length,runtime:runtime.map(({state,status,error})=>({state,status,error})),contrast_failures:contrast.filter(p=>p.ratio<p.minimum)},null,2));
