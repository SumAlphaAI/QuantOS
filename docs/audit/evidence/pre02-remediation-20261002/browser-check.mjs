import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const output=dirname(fileURLToPath(import.meta.url)); const root=resolve(output,'../../../..');
const req=createRequire(resolve(root,'package.json')); const uiReq=createRequire(resolve(root,'packages/ui/package.json'));
const { chromium }=req('@playwright/test');
const { build }=await import(createRequire(uiReq.resolve('vite')).resolve('esbuild'));
const axePath=createRequire(uiReq.resolve('@storybook/addon-a11y')).resolve('axe-core');
const tokens=JSON.parse(readFileSync(resolve(root,'packages/ui/src/tokens/tokens.json')));
const bundle=await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {ThemeProvider,I18nProvider,StateBadge} from './src/index'; const cfg=window.pre02; createRoot(document.getElementById('root')).render(<ThemeProvider theme={cfg.theme}><I18nProvider locale={cfg.locale}><main><h1>PRE-02 foundation</h1>{cfg.states.map(state=><StateBadge key={state} state={state}/>)}<label htmlFor="probe-input">Test input</label><input id="probe-input" className="q-input"/><button className="q-button">Test button</button></main></I18nProvider></ThemeProvider>);`,resolveDir:resolve(root,'packages/ui'),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const browser=await chromium.launch(); const results=[];
try {
 const page=await browser.newPage({viewport:{width:768,height:1024}});
 for(const theme of ['dark','light']) for(const locale of ['en','zh-CN']) {
  const states=[...Object.keys(tokens.stateColor),'some_future_enum','toString','constructor','__proto__'];
  await page.setContent('<!doctype html><html lang="'+(locale==='en'?'en':'zh-CN')+'"><head><title>PRE-02 foundation</title><style>'+readFileSync(resolve(root,'packages/ui/src/styles.css'),'utf8')+'</style></head><body><div id="root"></div></body></html>');
  await page.evaluate(cfg=>{window.pre02=cfg;},{theme,locale,states});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForSelector('[role="status"]');
  await page.addScriptTag({path:axePath});
  const actual=await page.evaluate(async()=>({badges:[...document.querySelectorAll('[role="status"]')].map(e=>({label:e.getAttribute('aria-label'),color:getComputedStyle(e).color,background:getComputedStyle(document.querySelector(".quantos-theme")).backgroundColor,fontSize:getComputedStyle(e).fontSize,gap:getComputedStyle(e).gap})),input:{border:getComputedStyle(document.querySelector('input')).borderTopColor,background:getComputedStyle(document.querySelector('input')).backgroundColor},axe:await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})}));
  const dictionary=JSON.parse(readFileSync(resolve(root,`packages/ui/src/i18n/${locale}.json`)));
  const rgb=hex=>`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
  const luminance=rgb=>{const c=rgb.match(/\d+/g).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
  const textRatios=actual.badges.map(b=>ratio(b.color,b.background));
  const boundaryRatio=ratio(actual.input.border,actual.input.background);
  if(textRatios.some(r=>r<4.5)||boundaryRatio<3) throw Error('computed contrast failure');
  for(const [i,state] of states.entries()) {
    const known=Object.hasOwn(tokens.stateColor,state);const path=known?tokens.stateColor[state]:'semantic.warning';const [group,key]=path.split('.');
    if(actual.badges[i]?.color!==rgb(tokens.color[theme][group][key])||actual.badges[i]?.label!==dictionary[known?'state.'+state:'state.unknown']) throw Error(`provider mismatch ${theme}/${locale}/${state}`);
  }
  if(actual.input.border!==rgb(tokens.color[theme].border.strong)) throw Error('input boundary token mismatch');
  const violations=actual.axe.violations.filter(v=>['serious','critical'].includes(v.impact));
  if(violations.length) throw Error(JSON.stringify(violations.map(v=>({id:v.id,impact:v.impact}))));
  await page.locator('input').focus();
  const focus=await page.locator('input').evaluate(e=>({width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor}));
  if(focus.width!==tokens.focus.ringWidth+'px'||focus.color!==rgb(tokens.color[theme].semantic.info)) throw Error('focus token mismatch');
  results.push({theme,locale,badges:actual.badges.length,minimum_computed_text_contrast:Math.min(...textRatios),computed_input_boundary_contrast:boundaryRatio,input:actual.input,focus,serious_critical_axe:0,all_violations:actual.axe.violations.map(v=>({id:v.id,impact:v.impact})),axe_incomplete:actual.axe.incomplete.map(v=>v.id)});
 }
 writeFileSync(resolve(output,'browser.json'),JSON.stringify({schema:'quantos-pre02-browser-foundation/v1',status:'PASS',engine:'Chromium',version:browser.version(),cases:results,boundary:'Standalone foundation harness using actual package exports/CSS; not all Storybook stories, full-page E2E, visual regression, screen-reader or staging acceptance.'},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',cases:results.length,badges_per_case:29,axe:'0 serious/critical in 4 foundation cases'},null,2));
} finally {await browser.close();}
