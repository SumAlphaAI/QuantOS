import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
const results=[];
try {
  for (const [app,port,path,selector] of [['website',3000,'/','[data-smoke="website-home"]'],['terminal',3100,'/command','[data-smoke="route-/command"]']]) {
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);await page.locator(selector).waitFor({state:'visible'});
    assert.deepEqual(errors,[]);
    for(const missing of ['/non-existent-pre03-route','/_next/non-existent-pre03.js']) assert.equal((await page.request.get(`http://127.0.0.1:${port}${missing}`)).status(),404);
    results.push({app,start_status:'PASS',browser_route:path,page_errors:errors,unknown_route_status:404,missing_asset_status:404});
    await page.close();
  }
} finally {await browser.close();}
console.log(JSON.stringify(results,null,2));
