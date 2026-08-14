import { designTokens } from "@sumalpha/ui";

/**
 * PRE-03 PoC：官网首页最小落地（SSG）。
 * 合规红线：不出现收益承诺、跟单、社区喊单或收益排行（A01/WEB-101）。
 * smoke 标记：data-smoke="website-home"。
 */
export default function HomePage() {
  const t = designTokens.color.dark;
  return (
    <main
      data-smoke="website-home"
      style={{ background: t.surface["0"], color: t.text.primary, minHeight: "100vh", padding: 24 }}
    >
      <h1 style={{ fontSize: 24, lineHeight: "32px", fontWeight: 600 }}>
        AI-native operating system for quantitative research and trading
      </h1>
      <ul style={{ color: t.text.secondary, fontSize: 14, lineHeight: "20px", marginTop: 16 }}>
        <li>Agent 不直接下单</li>
        <li>默认 Paper/Shadow</li>
        <li>全链路审计</li>
      </ul>
    </main>
  );
}
