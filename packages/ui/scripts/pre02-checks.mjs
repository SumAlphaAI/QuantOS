#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

const expectedSafetyCopy = {
  "safety.mode.paper": "PAPER · 模拟账本。不会向交易所提交订单。",
  "safety.mode.shadow": "SHADOW · 基于真实行情生成对照结果，不会提交订单。",
  "safety.mode.assistedLiveUnavailable": "Assisted Live 尚未开放。需完成 M5 Gate 并获得单独批准。",
  "safety.dataStale": "数据已超过允许时效。请刷新数据或等待数据恢复后再继续。",
  "safety.forbidden": "你没有访问此资源的权限。若认为这是错误，请联系主工作区管理员。",
  "safety.nonExecutableProposal": "这是交易建议，不是订单。请先完成确定性风险评估和必要审批。",
  "safety.commandExpired": "该交易命令已失效，无法提交。请重新进行风险评估。",
  "safety.noVenue": "当前没有可用于该标的的已授权健康交易所。请检查连接状态或联系管理员。",
  "safety.priceChanged": "报价已变化，订单尚未提交。请复核最新价格和预计成本后继续。",
  "safety.performanceBasis": "收益基于已确认的账本与估值快照，不代表未来表现。",
  "safety.reconciliationBreak": "发现账本与外部回报差异。该差异正在调查中，不应据此调整交易决策。",
  "safety.offline": "连接已断开。只读缓存仍可用；创建、审批和交易操作已暂停。",
  "safety.reauth": "此操作会影响交易风险。请完成身份验证后继续。",
  "safety.approvalRecorded": "审批已记录。系统将继续执行后续确定性校验。",
  "safety.approvalRejected": "已拒绝该请求。拒绝理由与规则上下文已写入审计记录。",
  "safety.killSwitch": "紧急停止已启用。系统拒绝新的交易命令，直至由授权人员解除。",
  "safety.loadFailed": "暂时无法加载此页面。请重试；如果问题持续，请复制关联 ID 联系支持。",
  "safety.noResults": "未找到符合当前筛选条件的结果。请调整筛选或清除条件。",
};

const expectedStates = {
  task: ["queued", "running", "succeeded", "failed", "cancelled"],
  risk: ["allow", "deny", "approval_required"],
  order: ["draft", "risk_checking", "awaiting_approval", "command_ready", "submitted", "accepted", "partially_filled", "filled", "cancelled", "rejected", "expired"],
  market: ["live", "delayed", "stale", "unavailable"],
  reconciliation: ["matched", "investigating", "resolved"],
};

const placeholders = (value) => [...value.matchAll(/\{([^{}]+)\}|\[([^\[\]]+)\]/g)].map((match) => match[1] ?? match[2]).sort();

const srgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
};

const luminance = (hex) => {
  const [red, green, blue] = srgb(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

function tableRows(markdown, start, end) {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) return [];
  return markdown.slice(startIndex, endIndex).split("\n").filter((line) => /^\|[^-].*\|$/.test(line)).slice(1);
}

export function validatePre02({ tokens, en, zh, storybookMain, storybookPreview, stateBadgeStories, componentInventory }) {
  const failures = [];
  const checks = [];
  const check = (condition, message) => {
    if (condition) checks.push(message);
    else failures.push(message);
  };

  check(tokens.$schema === "quantos-design-tokens/v1", "token schema is quantos-design-tokens/v1");
  check(tokens.meta?.adr === "docs/adr/20260814-pre02-design-tokens.md", "token ADR pointer is frozen");
  check(tokens.density?.default === "compact" && tokens.density?.compact?.rowHeight === 32 && tokens.density?.comfortable?.rowHeight === 40, "density contract is frozen");
  check(tokens.breakpoints?.full?.min === 1280 && tokens.breakpoints?.collapsed?.min === 768 && tokens.breakpoints?.readonly?.max === 767, "responsive breakpoints are frozen");
  check(tokens.breakpoints?.desktopMin?.width === 1180 && tokens.breakpoints?.desktopMin?.height === 760, "desktop minimum viewport is frozen");
  check(tokens.typography?.numeric?.fontVariantNumeric === "tabular-nums", "financial numeric typography uses tabular figures");

  for (const [domain, states] of Object.entries(expectedStates)) {
    check(JSON.stringify(tokens.stateEnum?.[domain]) === JSON.stringify(states), `${domain} state enum is exact`);
  }
  check(tokens.stateEnum?.unknownFallback?.includes("阻断高风险动作"), "unknown state fails closed");
  const enumStates = [...new Set(Object.values(expectedStates).flat())].sort();
  const mappedStates = Object.keys(tokens.stateColor ?? {}).sort();
  check(JSON.stringify(mappedStates) === JSON.stringify(enumStates), "stateColor covers every and only frozen state");

  const pairs = [];
  for (const themeName of ["dark", "light"]) {
    const theme = tokens.color?.[themeName];
    check(Boolean(theme), `${themeName} theme exists`);
    if (!theme) continue;
    pairs.push(
      [`${themeName}: text.primary / surface.0`, theme.text.primary, theme.surface["0"], 4.5],
      [`${themeName}: text.primary / surface.1`, theme.text.primary, theme.surface["1"], 4.5],
      [`${themeName}: text.secondary / surface.0`, theme.text.secondary, theme.surface["0"], 4.5],
      [`${themeName}: text.secondary / surface.1`, theme.text.secondary, theme.surface["1"], 4.5],
      [`${themeName}: brand.fg / brand.bg`, theme.brand.fg, theme.brand.bg, 4.5],
      [`${themeName}: brand.fg / brand.bgHover`, theme.brand.fg, theme.brand.bgHover, 4.5],
      ...Object.entries(theme.semantic).map(([key, value]) => [`${themeName}: semantic.${key} / surface.1`, value, theme.surface["1"], 4.5]),
      ...Object.entries(theme.mode).map(([key, value]) => [`${themeName}: mode.${key} / surface.0`, value, theme.surface["0"], 4.5]),
      [`${themeName}: chart.up / surface.0`, theme.chart.up, theme.surface["0"], 3],
      [`${themeName}: chart.down / surface.0`, theme.chart.down, theme.surface["0"], 3],
      [`${themeName}: focus / surface.0`, theme.semantic.info, theme.surface["0"], 3],
      [`${themeName}: focus / surface.1`, theme.semantic.info, theme.surface["1"], 3],
    );
  }
  for (const [label, foreground, background, minimum] of pairs) {
    const validColors = /^#[0-9A-F]{6}$/i.test(foreground) && /^#[0-9A-F]{6}$/i.test(background);
    check(validColors && contrast(foreground, background) >= minimum, `${label} >= ${minimum}:1`);
  }
  check(pairs.length === 36, "WCAG matrix contains 36 frozen pairs");

  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  check(JSON.stringify(enKeys) === JSON.stringify(zhKeys), "locale key sets match");
  for (const key of new Set([...enKeys, ...zhKeys])) {
    check(typeof en[key] === "string" && en[key].trim().length > 0 && typeof zh[key] === "string" && zh[key].trim().length > 0, `${key} is non-empty in both locales`);
  }
  const safetyKeys = Object.keys(expectedSafetyCopy).sort();
  check(JSON.stringify(enKeys.filter((key) => key.startsWith("safety."))) === JSON.stringify(safetyKeys), "safety key set is exact");
  for (const key of safetyKeys) {
    check(zh[key] === expectedSafetyCopy[key], `${key} matches normative Chinese copy`);
    check(typeof en[key] === "string" && en[key].trim().length > 0, `${key} has English copy`);
    check(JSON.stringify(placeholders(en[key] ?? "")) === JSON.stringify(placeholders(zh[key] ?? "")), `${key} placeholders match`);
  }
  check(zh["state.unknown"] === "未知/需升级", "unknown state copy is frozen");

  for (const addon of ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-interactions"]) {
    check(storybookMain.includes(addon), `Storybook includes ${addon}`);
  }
  for (const storyRoot of ["../src/**/*.stories", "../../domain-ui/src/**/*.stories", "../../../apps/terminal/app/**/*.stories"]) {
    check(storybookMain.includes(storyRoot), `Storybook scans ${storyRoot}`);
  }
  for (const marker of ["theme", "locale", "desktop1440", "desktop1280", "collapsed768", "readonly390", "color-contrast"]) {
    check(storybookPreview.includes(marker), `Storybook preview configures ${marker}`);
  }
  const expectedBaselineStories = ["Default", "ApprovalRequired", "Denied", "Stale", "UnknownFallback", "LightTheme", "ReadonlyViewport"];
  for (const story of expectedBaselineStories) check(new RegExp(`export const ${story}\\b`).test(stateBadgeStories), `StateBadge exports ${story}`);

  const commonRows = tableRows(componentInventory, "## 1. 通用组件", "## 2. 领域组件");
  const domainRows = tableRows(componentInventory, "## 2. 领域组件", "## 3. Storybook 覆盖约定");
  check(commonRows.length === 19, "component inventory has 19 common rows");
  check(domainRows.length === 25, "component inventory has 25 domain rows");
  for (const phrase of ["默认/加载/空/错误/无权/陈旧/离线/危险确认", "axe 面板严重/高等级问题为 0", "390 只读", "深浅主题"]) {
    check(componentInventory.includes(phrase), `component inventory includes ${phrase}`);
  }

  return { schema: "quantos-pre02/v1", status: failures.length === 0 ? "PASS" : "FAIL", failures, checks, wcag_pairs: pairs.length, safety_keys: safetyKeys.length, common_component_rows: commonRows.length, domain_component_rows: domainRows.length, baseline_stories: expectedBaselineStories.length };
}

export function loadCurrentPre02() {
  return {
    tokens: JSON.parse(readFileSync(join(packageRoot, "src/tokens/tokens.json"), "utf8")),
    en: JSON.parse(readFileSync(join(packageRoot, "src/i18n/en.json"), "utf8")),
    zh: JSON.parse(readFileSync(join(packageRoot, "src/i18n/zh-CN.json"), "utf8")),
    storybookMain: readFileSync(join(packageRoot, ".storybook/main.ts"), "utf8"),
    storybookPreview: readFileSync(join(packageRoot, ".storybook/preview.tsx"), "utf8"),
    stateBadgeStories: readFileSync(join(packageRoot, "src/components/StateBadge/StateBadge.stories.tsx"), "utf8"),
    componentInventory: readFileSync(join(repoRoot, "docs/PRE-02-component-inventory.md"), "utf8"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = validatePre02(loadCurrentPre02());
  if (report.status === "FAIL") {
    for (const failure of report.failures) console.error(`FAIL  ${failure}`);
    process.exitCode = 1;
  } else {
    const { checks: _checks, failures: _failures, ...summary } = report;
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
}
