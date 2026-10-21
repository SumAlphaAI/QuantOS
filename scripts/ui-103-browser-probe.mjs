// Real Chromium component composition only: no business provider, target credential or server reuse.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const output=process.argv[2];assert(output,'explicit new evidence directory required');mkdirSync(output,{recursive:true});
const base=resolve('packages/ui/storybook-static');const index=JSON.parse(readFileSync(base+'/index.json'));const rows=[],errors=[],blocked=[];const completeStoryMatrix=process.argv[3]!=='--interactions-only';
const server=createServer((req,res)=>{try{const p=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));assert(p.startsWith(base+sep));assert(statSync(p).isFile());res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(p)]??'application/octet-stream');res.end(readFileSync(p));}catch{res.statusCode=404;res.end('not found');}});
await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))return route.continue();blocked.push(url.origin);return route.abort();});
async function story(id,theme='dark',locale='en'){
 await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};locale:${locale}`,{waitUntil:'networkidle'});
 await expect(page.locator('#storybook-root')).not.toBeEmpty();await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
}
async function axe(id){const result=await new AxeBuilder({page}).include(await page.getByRole('dialog').count() ? '[role="dialog"]' : '#storybook-root').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();const failures=result.violations.filter(v=>['critical','serious'].includes(v.impact));rows.push({id,status:failures.length?'FAIL':'PASS',violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>v.id)});writeFileSync(output+'/axe.json',JSON.stringify(rows,null,2)+'\n');assert.equal(failures.length,0,JSON.stringify(failures.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));}
try{
 const selected=Object.values(index.entries).filter(s=>s.type==='story'&&/^(ui\/|foundation\/|domain-ui\/|integration\/UI103)/i.test(s.title));
 assert(selected.some(s=>s.id==='integration-ui103--current-function'));assert(selected.length>=50);
 if(completeStoryMatrix)for(const theme of ['dark','light'])for(const s of selected){await story(s.id,theme);await axe(theme+':'+s.id);}
 await story('integration-ui103--current-function');
 const region=page.getByRole('region',{name:'Orders table scroll area'});
 await expect(region.getByRole('table')).toHaveAttribute('aria-rowcount','1001');
 await region.evaluate(e=>e.scrollTop=e.scrollHeight);await expect(region.getByRole('cell',{name:'row-999',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Short dataset'}).click();await expect(region.getByRole('cell',{name:'row-0',exact:true})).toBeVisible();assert.equal(await region.evaluate(e=>e.scrollTop),0);
 const pins=await region.locator('th').evaluateAll(th=>th.filter(e=>getComputedStyle(e).position==='sticky'&&getComputedStyle(e).right!=='auto').map(e=>({right:parseFloat(getComputedStyle(e).right),width:e.getBoundingClientRect().width})));
 assert.equal(pins.length,2);assert(Math.abs(pins[0].right-pins[1].width)<1,'actual measured right pins must not overlap');
 const ids=await page.locator('h2').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
 await page.getByRole('searchbox',{name:'Search'}).fill('BTC');await expect(page).toHaveURL(/review.filter.query=BTC/);
 await page.getByRole('button',{name:'ID',exact:true}).click();await expect(page.getByRole('columnheader',{name:'ID',exact:true})).toHaveAttribute('aria-sort','descending');
 await page.getByRole('button',{name:'Next page'}).click();await expect(page).toHaveURL(/review.page=2/);
 await page.getByRole('button',{name:'Switch theme'}).click();await expect(page.getByRole('searchbox')).toHaveValue('BTC');
 await page.getByRole('button',{name:'Switch language'}).click();await expect(page.getByRole('button',{name:'下一页'})).toBeVisible();await expect(page.locator('.q-alert__title').filter({hasText:'当前离线'})).toBeVisible();await expect(page.getByRole('searchbox')).toHaveValue('BTC');
 await page.getByRole('button',{name:'Switch language'}).click();
 await page.getByText('View evidence details',{exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText('Local fixture evidence only')).toBeVisible();
 writeFileSync(output+'/accessibility-tree.yml',await page.locator('main').ariaSnapshot());
 // Real keyboard traversal, Cancel initial focus, trap and trigger restoration.
 const trigger=page.getByRole('button',{name:'Open confirmation'});await trigger.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Confirm local fixture action'}),cancel=page.getByRole('button',{name:'Cancel',exact:true});
 await expect(cancel).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByLabel('Type “CONFIRM” to confirm')).toBeFocused();
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)),'focus escaped dialog');}
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.getByLabel('Type “CONFIRM” to confirm').fill('confirm');await page.getByLabel('MFA code').fill('123456');await expect(page.getByRole('button',{name:'Submit action'})).toBeDisabled();
 await page.getByLabel('Type “CONFIRM” to confirm').fill('CONFIRM');await page.getByRole('button',{name:'Submit action'}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByRole('status',{name:'Callback count'})).toHaveText('1');
 await page.getByLabel('Callback outcome').selectOption('error');await trigger.click();await page.getByLabel('Type “CONFIRM” to confirm').fill('CONFIRM');await page.getByLabel('MFA code').fill('123456');await page.getByRole('button',{name:'Submit action'}).click();await expect(dialog.getByText('Submission failed',{exact:true})).toBeVisible();await expect(page.getByText('private-upstream-error')).toHaveCount(0);await expect(page.getByLabel('MFA code')).toHaveValue('');await expect(page.getByRole('button',{name:'Submit action'})).toBeDisabled();
 await axe('dialog-error');writeFileSync(output+'/dialog-accessibility-tree.yml',await dialog.ariaSnapshot());await cancel.click();
 for(const [name,width,theme,locale,zoom] of [['dark-en-1440',1440,'dark','en',1],['light-zh-1440',1440,'light','zh-CN',1],['dark-en-768',768,'dark','en',1],['light-zh-390',390,'light','zh-CN',1],['dark-en-200pct',720,'dark','en',2]]){
  await page.setViewportSize({width,height:1000});await story('integration-ui103--current-function',theme,locale);
  // 1440 physical / 2 = 720 CSS px models desktop 200% reflow; no pinch-only deviceScaleFactor claim.
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert(size.scroll<=size.client+1,JSON.stringify({name,size}));
  await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
  await page.getByRole('button',{name:'Open confirmation'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  const box=await page.getByRole('dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,JSON.stringify({name,box}));
  assert(await page.getByRole('dialog').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+30));}),'table overlays modal');await axe(name+':dialog');await page.screenshot({path:output+'/'+name+'-dialog.png',fullPage:true});
  rows.push({id:name,status:'PASS',cssWidth:width,equivalentDesktopZoom:zoom,reflow:size});
 }
 await page.setViewportSize({width:1440,height:1000});await story('integration-ui103--current-function');await page.getByLabel('Callback outcome').selectOption('pending');await page.getByRole('button',{name:'Open confirmation'}).click();await page.getByLabel('Type “CONFIRM” to confirm').fill('CONFIRM');await page.getByLabel('MFA code').fill('123456');await page.getByRole('button',{name:'Submit action'}).dblclick({force:true});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Submit action'})).toBeDisabled();
 await axe('dialog-pending');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(output+'/browser.json',JSON.stringify({schema:'quantos-ui103-browser/v1',status:'PASS',completeStoryMatrix,browser:await browser.version(),stories:selected.map(s=>s.id),axeRuns:rows.filter(r=>r.violations).length,checks:['virtual-window-recovery','last-row-reachable','measured-right-pins','unique-heading-ids','controlled-server-sort-page-filter-url','theme-locale-preserve-input','keyboard-details','initial-cancel-focus','focus-trap','escape-restore','exact-phrase-mfa','callback-single-submit','safe-error-mfa-reset','pending-no-dismiss','responsive-dialog','200pct-reflow-equivalence','accessibility-tree'],errors,blocked,manualScreenReader:'NOT_RUN',visualBaselines:'NEW_CAPTURE_REVIEW_REQUIRED',businessApi:'NOT_APPLICABLE'},null,2)+'\n');console.log('UI103_BROWSER_PASS',selected.length,rows.length);
}catch(e){writeFileSync(output+'/failure.json',JSON.stringify({status:'FAIL',message:e.message,errors,blocked},null,2));await page.screenshot({path:output+'/failure.png',fullPage:true});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
