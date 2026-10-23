# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fep3-function.spec.ts >> FEP3 terminal report parameter drift clears report and blocks Release
- Location: tests/e2e/fep3-function.spec.ts:13:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "报告不可用"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert">报告不可用（502）。请核对任务引用、授权或稍后显式刷新。</p> aka getByText('报告不可用（502）。请核对任务引用、授权或稍后显式刷新。')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')
    - locator resolved to <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div>
    - unexpected value ""

```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import {writeFile} from "node:fs/promises";
  3  | import {createHash} from "node:crypto";
  4  | import {openLab,authorized,networkRows,installReferenceHooks} from "./fixtures/ui301-reference";
  5  | installReferenceHooks();
  6  | const hash=(text:string)=>"sha256:"+createHash("sha256").update(text).digest("hex");
  7  | async function report(page:Page){await openLab(page,false);await page.getByRole("button",{name:"运行静态检查",exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole("button",{name:"创建回测",exact:true}).click();await page.getByRole("link",{name:/回测报告 v/}).first().click();await authorized(page);await expect(page.getByText(/事件流：complete/)).toBeVisible();await expect(page.getByTestId("raw-backtest-report")).toBeAttached();}
  8  | test("FEP3 mismatched save echo locks editor and retries the same committed request",async({page},info)=>{
  9  |  await openLab(page,false);let corrupt=true;const delivery:unknown[]=[];
  10 |  await page.route(/\/v1\/strategies\/[^/]+\/draft$/,async route=>{const response=await route.fetch();if(route.request().method()!=="PUT"||!corrupt){await route.fulfill({response});return;}corrupt=false;const original=await response.text(),body=JSON.parse(original);body.files={"strategy.rule":"EXPLICIT_TEST_RESPONSE_CORRUPTION"};const changed=JSON.stringify(body);delivery.push({path:new URL(route.request().url()).pathname,source:"EXPLICIT_TEST_RESPONSE_CORRUPTION_NOT_BFF_OUTPUT",originalSha256:hash(original),deliveredSha256:hash(changed)});await route.fulfill({response,body:changed});});
  11 |  const editor=page.getByLabel("文件内容",{exact:true}),original=await editor.inputValue();await editor.fill(original+"\n# local reviewed edit");await expect(page.getByRole("button",{name:"以原请求重试保存",exact:true})).toBeVisible();await expect(editor).toBeDisabled();await expect(page.getByRole("button",{name:"创建回测",exact:true})).toBeDisabled();await page.getByRole("button",{name:"以原请求重试保存",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已保存 · objectVersion：2"})).toBeVisible();const puts=networkRows().filter(r=>r.method==="PUT");expect(puts).toHaveLength(2);expect(puts[0].keyHash).toBe(puts[1].keyHash);expect(puts[0].bodyHash).toBe(puts[1].bodyHash);await writeFile(info.outputPath("fep3-fault.json"),JSON.stringify({kind:"save-echo",sourceCommit:process.env.GITHUB_SHA,delivery,puts},null,2));
  12 | });
  13 | test("FEP3 terminal report parameter drift clears report and blocks Release",async({page},info)=>{
  14 |  await report(page);const before=JSON.parse((await page.getByTestId("raw-backtest-report").textContent())!);let injected=0;
  15 |  await page.route(/\/v1\/backtests\/[^/]+$/,async route=>{const response=await route.fetch(),body=await response.json();body.parameters={...body.parameters,lookback:999};injected++;await route.fulfill({response,json:body});});
> 16 |  await page.getByRole("button",{name:"刷新报告与事件流",exact:true}).click();await expect(page.getByRole("alert")).toContainText("报告不可用");await expect(page.getByTestId("raw-backtest-report")).toHaveCount(0);await expect(page.getByRole("button",{name:"创建不可变 Release",exact:true})).toHaveCount(0);expect(networkRows().some(r=>r.method==="POST"&&r.path==="/v1/releases")).toBe(false);await writeFile(info.outputPath("fep3-fault.json"),JSON.stringify({kind:"terminal-parameters",source:"EXPLICIT_TEST_RESPONSE_CORRUPTION_NOT_BFF_OUTPUT",sourceCommit:process.env.GITHUB_SHA,injected,reportHash:before.reportHash,parameters:before.parameters}));
     |                                                                                                            ^ Error: expect(locator).toContainText(expected) failed
  17 | });
  18 | test("FEP3 first Release detail cross-checks report parameters before displaying a candidate",async({page},info)=>{
  19 |  await report(page);await page.getByRole("button",{name:"创建不可变 Release",exact:true}).click();const link=page.getByRole("link",{name:"查看 Release 详情",exact:true});await expect(link).toBeVisible();let injected=0;
  20 |  await page.route(/\/v1\/backtests\/[^/]+$/,async route=>{const response=await route.fetch(),body=await response.json();body.parameters={...body.parameters,lookback:999};injected++;await route.fulfill({response,json:body});});
  21 |  await link.click();await authorized(page);await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByTestId("raw-release")).toHaveCount(0);await expect(page.getByLabel("目标选择",{exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"提交审批申请",exact:true})).toBeDisabled();expect(networkRows().some(r=>r.path.includes("approval-submissions"))).toBe(false);await writeFile(info.outputPath("fep3-fault.json"),JSON.stringify({kind:"release-report-parameters",source:"EXPLICIT_TEST_RESPONSE_CORRUPTION_NOT_BFF_OUTPUT",sourceCommit:process.env.GITHUB_SHA,injected}));
  22 | });
  23 | 
```