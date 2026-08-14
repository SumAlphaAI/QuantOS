import designTokens from "../../tokens/index";

const tokens = designTokens;

/**
 * StateBadge —— 状态标签基准组件。
 * 规则（ADR 20260814-pre02）：每个状态必须同时具备文字、图标、语义色与读屏标签；
 * 未知枚举回退 "未知/需升级"，不得落入默认 allow。
 */

export type StateDomain = keyof typeof tokens.stateColor;

const ICONS: Record<string, string> = {
  "semantic.success": "●",
  "semantic.warning": "▲",
  "semantic.danger": "■",
  "semantic.info": "◆",
  "text.secondary": "○",
};

const UNKNOWN_LABEL: Record<"en" | "zh-CN", string> = {
  en: "Unknown / upgrade required",
  "zh-CN": "未知/需升级",
};

export interface StateBadgeProps {
  /** stateColor 中冻结的状态键，如 "running"、"approval_required" */
  state: string;
  /** 展示文案（来自 i18n，调用方注入；组件不内置领域文案） */
  label?: string;
  locale?: "en" | "zh-CN";
  theme?: "dark" | "light";
}

function resolveColorToken(state: string): string {
  return (tokens.stateColor as Record<string, string>)[state] ?? "semantic.warning";
}

function resolveHex(tokenPath: string, theme: "dark" | "light"): string {
  const [group, key] = tokenPath.split(".");
  const palette = tokens.color[theme] as unknown as Record<string, Record<string, string>>;
  return palette[group]?.[key] ?? tokens.color[theme].semantic.warning;
}

export function StateBadge({ state, label, locale = "zh-CN", theme = "dark" }: StateBadgeProps) {
  const known = state in tokens.stateColor;
  const tokenPath = resolveColorToken(state);
  const color = resolveHex(tokenPath, theme);
  const text = known ? (label ?? state) : UNKNOWN_LABEL[locale];
  return (
    <span
      role="status"
      aria-label={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color,
        fontSize: 13,
        lineHeight: "18px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span aria-hidden="true">{ICONS[tokenPath] ?? "▲"}</span>
      <span>{text}</span>
    </span>
  );
}

export default StateBadge;
