import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWebsiteShell } from "../src/index.js";

const APP_DIR = join(__dirname, "..", "app");

function collectSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectSources(path);
    return /\.(tsx?|css)$/.test(entry) ? [path] : [];
  });
}

/** 宣传禁用词：官网不得出现收益承诺、投机诱导表述（A01/WEB-101 合规红线）。 */
const FORBIDDEN_PROMOTIONAL = [
  "保证收益", "稳赚", "保本", "年化收益", "躺赚", "翻倍", "财富自由", "暴富",
  "一键跟单", "智能跟单", "跟单获利", "加入喊单", "收益排行榜",
  "guaranteed return", "risk-free profit", "get rich",
];

const REQUIRED_PAGES = [
  "page.tsx",
  "product/page.tsx",
  "architecture-security/page.tsx",
  "use-cases/page.tsx",
  "docs/page.tsx",
  "access-request/page.tsx",
  "login/page.tsx",
];

describe("website shell", () => {
  it("renders the website badge", () => {
    expect(renderWebsiteShell()).toBe("[sumalpha-quantos:website]");
  });
});

describe("WEB-101 content compliance", () => {
  const sources = collectSources(APP_DIR);

  it("ships all first-phase pages", () => {
    for (const page of REQUIRED_PAGES) {
      expect(sources.some((path) => path.endsWith(page)), `missing ${page}`).toBe(true);
    }
  });

  it("contains no promotional or return-guarantee wording", () => {
    for (const path of sources) {
      const content = readFileSync(path, "utf8").toLowerCase();
      for (const phrase of FORBIDDEN_PROMOTIONAL) {
        expect(content.includes(phrase.toLowerCase()), `${path} contains forbidden phrase: ${phrase}`).toBe(false);
      }
    }
  });

  it("states the non-execution boundary on public pages", () => {
    const home = readFileSync(join(APP_DIR, "page.tsx"), "utf8");
    expect(home).toContain("Agent 不直接下单");
    expect(home).toContain("Paper / Shadow");
  });

  it("access request form carries anti-abuse and privacy semantics", () => {
    const form = readFileSync(join(APP_DIR, "access-request", "_form.tsx"), "utf8");
    expect(form).toContain("honeypot");
    expect(form).toContain("privacyNoticeVersion");
    expect(form).toContain("429");
    expect(form).toContain("navigator.onLine");
    expect(form).toContain('name="expectedMode"');
    expect(form).not.toContain("权限已经开通\""); // 仅允许否定式表述
    expect(form).toContain("不代表访问权限已经开通");
  });

  it("ships the frozen seven-page routes and documentation empty state", () => {
    const docs = readFileSync(join(APP_DIR, "docs", "_docs-index.tsx"), "utf8");
    expect(sources.some((path) => path.endsWith("scenarios/page.tsx"))).toBe(false);
    expect(docs).toContain("没有匹配的文档");
    expect(docs).toContain("清除搜索条件");
    expect(docs).toContain("联系支持");
  });
});
