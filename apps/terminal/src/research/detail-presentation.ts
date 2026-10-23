import type {ResearchRun} from "./policy";
/** Status is always the last authorized C03 read, never inferred from SSE text. */
export const researchDetailNotice:Record<ResearchRun["status"],string>={
 queued:"研究已排队。等待服务端调度，中间输出不代表最终结论。",
 running:"研究正在执行。中间输出不代表最终结论。",
 succeeded:"研究已完成。请结合证据与数据质量评估结果。",
 failed:"研究未完成。已保留可用的日志和中间产物。",
 cancelled:"研究已取消。已返回的证据引用仍可按权限核对。",
 cancel_requested:"正在请求取消。受理不等于任务已停止，等待详情确认。"
};
export function researchDetailMetrics(run:ResearchRun){return{progress:"未提供",cost:run.costUnits===undefined?"未提供":run.costUnits,budget:run.budget,deadlineAt:run.deadlineAt,engine:run.engineVersion};}
