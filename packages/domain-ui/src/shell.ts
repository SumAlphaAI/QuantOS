/**
 * Shared App Shell, routing metadata, and viewport risk rules for the
 * QuantOS Terminal. All business pages are `noindex`; high-risk actions are
 * hidden on small screens regardless of capability.
 */

export type TerminalRoute =
  | "/login"
  | "/mfa"
  | "/access-request"
  | "/unauthorized"
  | "/offline"
  | "/command"
  | "/research"
  | "/research/new"
  | "/research/:runId"
  | "/artifacts/:artifactId"
  | "/data-snapshots"
  | "/data-snapshots/:snapshotId"
  | "/strategies"
  | "/strategies/new"
  | "/strategies/:strategyId/lab"
  | "/backtests/:runId"
  | "/releases"
  | "/releases/:releaseId";

export type RiskActionKind =
  | "start_research"
  | "cancel_run"
  | "create_strategy_draft"
  | "export_artifact"
  | "request_access"
  | "submit_release"
  | "approve_release"
  | "select_deployment_target";

export interface PageMeta {
  route: TerminalRoute;
  title: string;
  /** Business surfaces must always be excluded from indexing. */
  robots: "noindex" | "index";
  /** Actions that move money risk or mutate controlled state. */
  highRiskActions: RiskActionKind[];
}

export const PAGE_REGISTRY: PageMeta[] = [
  {
    route: "/login",
    title: "进入 QuantOS Terminal",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/mfa",
    title: "完成多因素验证",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/access-request",
    title: "申请访问 QuantOS Terminal",
    robots: "noindex",
    highRiskActions: ["request_access"],
  },
  {
    route: "/unauthorized",
    title: "访问受限",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/offline",
    title: "网络不可用",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/command",
    title: "Command Center",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/research",
    title: "Research",
    robots: "noindex",
    highRiskActions: ["start_research"],
  },
  {
    route: "/research/new",
    title: "发起研究",
    robots: "noindex",
    highRiskActions: ["start_research"],
  },
  {
    route: "/research/:runId",
    title: "研究详情",
    robots: "noindex",
    highRiskActions: ["cancel_run", "create_strategy_draft"],
  },
  {
    route: "/artifacts/:artifactId",
    title: "Artifact 详情",
    robots: "noindex",
    highRiskActions: ["export_artifact"],
  },
  {
    route: "/data-snapshots",
    title: "数据快照",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/data-snapshots/:snapshotId",
    title: "数据快照详情",
    robots: "noindex",
    highRiskActions: ["start_research"],
  },
  {
    route: "/strategies",
    title: "Strategies",
    robots: "noindex",
    highRiskActions: ["create_strategy_draft"],
  },
  {
    route: "/strategies/new",
    title: "新建策略",
    robots: "noindex",
    highRiskActions: ["create_strategy_draft"],
  },
  {
    route: "/strategies/:strategyId/lab",
    title: "Strategy Lab",
    robots: "noindex",
    highRiskActions: ["submit_release"],
  },
  {
    route: "/backtests/:runId",
    title: "回测详情",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/releases",
    title: "Strategy Releases",
    robots: "noindex",
    highRiskActions: [],
  },
  {
    route: "/releases/:releaseId",
    title: "Release 详情",
    robots: "noindex",
    highRiskActions: ["approve_release", "select_deployment_target"],
  },
];

export type ViewportSize = "small" | "regular";

export const SMALL_VIEWPORT_MAX_WIDTH_PX = 767;

export function viewportForWidth(widthPx: number): ViewportSize {
  return widthPx <= SMALL_VIEWPORT_MAX_WIDTH_PX ? "small" : "regular";
}

/**
 * Resolve which high-risk actions a page may render. Small screens never show
 * high-risk actions; regular screens show them (capability checks happen
 * server-side and in the action handlers).
 */
export function visibleHighRiskActions(
  page: PageMeta,
  viewport: ViewportSize,
): RiskActionKind[] {
  if (viewport === "small") {
    return [];
  }
  return [...page.highRiskActions];
}

export interface AppShellModel {
  modeBanner: string;
  navigation: { route: TerminalRoute; label: string }[];
  currentRoute: TerminalRoute;
  viewport: ViewportSize;
}

export function buildAppShell(
  currentRoute: TerminalRoute,
  viewport: ViewportSize,
  modeBanner: string,
): AppShellModel {
  return {
    modeBanner,
    currentRoute,
    viewport,
    navigation: [
      { route: "/command", label: "Command Center" },
      { route: "/research", label: "Research" },
      { route: "/strategies", label: "Strategies" },
      { route: "/data-snapshots", label: "数据快照" },
    ],
  };
}

export function pageMetaFor(route: TerminalRoute): PageMeta {
  const page = PAGE_REGISTRY.find((entry) => entry.route === route);
  if (!page) {
    throw new Error(`unknown terminal route ${route}`);
  }
  return page;
}
