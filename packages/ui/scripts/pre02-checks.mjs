#!/usr/bin/env node
/**
 * PRE-02 基础检查：
 * 1) WCAG 2.2 AA 对比度 —— tokens.json 中所有文字/语义色配对
 * 2) i18n 完整性 —— en.json 与 zh-CN.json key 集合一致且通用安全文案全部入库
 *
 * 运行：node packages/ui/scripts/pre02-checks.mjs
 * 任一检查失败以非零码退出（供 CI 使用）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "src/tokens/tokens.json"), "utf8"));
const en = JSON.parse(readFileSync(join(root, "src/i18n/en.json"), "utf8"));
const zh = JSON.parse(readFileSync(join(root, "src/i18n/zh-CN.json"), "utf8"));

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`FAIL  ${msg}`); };
const pass = (msg) => console.log(`ok    ${msg}`);

// ---------- WCAG contrast ----------
const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};
const luminance = (hex) => {
  const [r, g, b] = srgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [label, fg, bg, minRatio] —— 正文 4.5，大字/图形 3.0
const pairs = [];
for (const themeName of ["dark", "light"]) {
  const t = tokens.color[themeName];
  pairs.push(
    [`${themeName}: text.primary / surface.0`, t.text.primary, t.surface["0"], 4.5],
    [`${themeName}: text.primary / surface.1`, t.text.primary, t.surface["1"], 4.5],
    [`${themeName}: text.secondary / surface.0`, t.text.secondary, t.surface["0"], 4.5],
    [`${themeName}: text.secondary / surface.1`, t.text.secondary, t.surface["1"], 4.5],
    [`${themeName}: brand.fg / brand.bg`, t.brand.fg, t.brand.bg, 4.5],
    [`${themeName}: brand.fg / brand.bgHover`, t.brand.fg, t.brand.bgHover, 4.5],
  );
  for (const [k, v] of Object.entries(t.semantic)) {
    pairs.push([`${themeName}: semantic.${k} / surface.1`, v, t.surface["1"], 4.5]);
  }
  for (const [k, v] of Object.entries(t.mode)) {
    pairs.push([`${themeName}: mode.${k} / surface.0`, v, t.surface["0"], 4.5]);
  }
  pairs.push(
    [`${themeName}: chart.up / surface.0 (图形 3:1)`, t.chart.up, t.surface["0"], 3.0],
    [`${themeName}: chart.down / surface.0 (图形 3:1)`, t.chart.down, t.surface["0"], 3.0],
  );
}
for (const [label, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  if (ratio >= min) pass(`${label}  ${ratio.toFixed(2)}:1 >= ${min}:1`);
  else fail(`${label}  ${ratio.toFixed(2)}:1 < ${min}:1`);
}

// ---------- i18n ----------
const enKeys = Object.keys(en).sort();
const zhKeys = Object.keys(zh).sort();
if (JSON.stringify(enKeys) === JSON.stringify(zhKeys)) {
  pass(`i18n key 集合一致（${enKeys.length} keys）`);
} else {
  fail(`i18n key 不一致：en-only=[${enKeys.filter((k) => !zhKeys.includes(k))}] zh-only=[${zhKeys.filter((k) => !enKeys.includes(k))}]`);
}
for (const k of enKeys) {
  if (!en[k] || !zh[k]) fail(`i18n 空值：${k}`);
}
const safetyPrefix = "safety.";
const safetyKeys = enKeys.filter((k) => k.startsWith(safetyPrefix));
// 设计规格 3.3 节通用展示文案库共 18 条，全部以 safety.* 入库
if (safetyKeys.length >= 18) pass(`通用安全文案全部入 i18n（safety.* 共 ${safetyKeys.length} 条）`);
else fail(`通用安全文案不足：safety.* 仅 ${safetyKeys.length} 条，要求 >= 18`);

if (failures > 0) {
  console.error(`\n${failures} 项检查失败`);
  process.exit(1);
}
console.log("\nPRE-02 基础检查全部通过");
