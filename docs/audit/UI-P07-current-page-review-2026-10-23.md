# UI-P07 当前页面审阅（2026-10-23）

限定工程Gate：**PASS_UI_P07_CURRENT_PAGE**。冻结候选 `636f46a45ff464010f7776a5f0c87b5e34b087d4`；最终 `attempt-01`，确认PENDING，UI-P07开发状态IMPLEMENTED_PENDING_ACCEPTANCE。所有159个阶段门禁保持NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。

## 页面与设计映射

依据 `design/P07-Backtest-Detail-and-Strategy-Release-High-Fidelity-v1.png`，实现 `/backtests/:runId`、`/releases`、`/releases/:releaseId`。共用冻结Terminal shell和语义tokens，亮暗主题/主题切换、桌面分栏/平板堆叠/手机单列。主区固定输入条、六指标、概览/成交/成本/验证页签，右栏不可变包、审批时间线与目标卡。

| 设计要素 | 实现与实际边界 |
| --- | --- |
| 固定输入/指标 | snapshot/environment/clock/fee_bps/slippage_bps/reportHash可见，全文复制和原文保留；收益/回撤/Sharpe标明≈，原始精度在成本页签/JSON保留，费用/金额不截断 |
| 净值/回撤/基准图 | C05未提供时序，明确缺项；改展示真实fill累计fee+slippage、execution_bar实际间距及数值表，不伪造收益/时间/标的 |
| 成交/校验 | 8笔本地分页、真实side long/short/flat、费用/滑点/价格；四页签支持键盘；泄漏/哈希/输入字段完整核对 |
| 不可变包 | 创建前后沿用UI303重读和一致性门禁，详情左侧显示已核对绑定报告；读取失败/撤权清除；参数/研究证据展开查看，完整JSON和Artifact入口保留 |
| 审批/目标 | timeline使用真实submitted/approve actor/time/correlation，并链接Audit；202不当批准，无产品自批；只列后端allowedTargets，批准且有效才可选Paper/Shadow，选择不发部署命令 |
| 目录 | 真实名称/ID/状态/contentHash/绑定回测/UTC到期；搜索仅当前页，后端排序分页，未推算全局数量或owner |
| 未接入动作 | 比较禁用且说明需要接口；导出/回滚/部署未提供操作，不创造权限或数据 |

C10本轮是服务端correlationId的Audit路由链接，不构成Audit Explorer完整联调。完整操作/映射见 [操作文档](../operations/ui-p07-backtest-release.md)。

## 命令与结果

所有命令、起止时间、退出码、输出摘要见 [executions.json](evidence/ui-p07-local-20261023/attempt-01/executions.json)。统一入口：

```sh
node scripts/ui-p07-review.mjs --run docs/audit/evidence/ui-p07-local-20261023/attempt-01
node scripts/ui-p07-review.mjs --verify
```

| 命令 | 结果 |
| --- | --- |
| pnpm exec vitest run（P07 presentation、UI303/302/301、恢复、P06 presentation、真实provider consumer七文件） | 141/141，0 pending |
| pnpm --filter @sumalpha/terminal typecheck | PASS |
| pnpm exec eslint（直接影响源码/测试/工具） | PASS |
| node --test scripts/ui-p07-review.test.mjs scripts/ui303-confirmed-reference.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs | 17/17 |
| pnpm --filter @sumalpha/terminal build | PASS，buildId=terminal-636f46a45ff464010f7776a5f0c87b5e34b087d4；client secret检查110文件通过 |
| pnpm exec playwright test --config=playwright.ui-p07.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p07-local-20261023/attempt-01/browser | 14/14，0 skipped/flaky/retry；18已提交基线独立比较，maxDiffPixelRatio=.005，无update参数 |
| node scripts/check-development-plans.mjs | PASS，159 NOT_ASSESSED |
| node scripts/development-execution.mjs --integration FE:UI-P07 | exit1，按预期拒绝扩大阶段准入 |
| node scripts/development-execution.mjs --development FRONTEND-GATE:G3 | allowed=true仅允许准备/开发，不是G3评估通过 |

22次axe扫描0 violations、22 incomplete；P07矩阵18，原UI302/303直接回归4。图标/非文本、SVG图形背景对比度无法由自动工具判定，保留原始节点和原因，不宣称通过人工检查。历史UI302 12、P06 18、前次UI301回归12和原UI301 8条记录保持原状，未去重、未关闭。六张补充截图直接查看审批时间线/目标区域；人工读取截图仅为本机排版审阅，不代替读屏/native zoom/跨平台矩阵。

UI303原Rust binary源c1774a74，245个Rust输入和binary sha256逐项未变；P07不重建、不重验其21项Rust，原结果仅原范围参考。当前Terminal构建和运行fixture GITHUB_SHA绑定本候选，binary构建来源另列，不混称同SHA重建。

## 失败保留与风险

[探索摘要](evidence/ui-p07-local-20261023/exploratory-notes.md)区分未保存raw的早期类型输出与runner原始记录。preflight-01为13/14，旧reportHash定位歧义已修；preflight-02为13/14，helper在草稿读取完成前捕获空规则已修（等待已保存版本）；preflight-03为14/14视觉种子，仍非验收。最终attempt-01独立运行，不拼接预检PASS。

真实IdP/MFA/cookie/CORS、Supabase/Storage/RLS/持久恢复、生产hosting、Firefox/WebKit、人工读屏/native200%、跨OS、Storybook构建、远程同SHA CI、性能/容量/长稳、完整联调/发布、部署和交易全部NOT_RUN。未使用生产凭据、未推送/部署/外部发布。C05缺失净值/回撤/基准时序与逐笔时间/标的；未来补契约后需新增真实呈现和直接测试。累计成本只是受限展示，不参与审批/财务决策。

UI303确认原文与摘要提交5d9d006e，严格绑定c1774a74及证据包3a66e307，原稿/旧NOT_RUN不改写。P07 [待确认文稿](evidence/ui-p07-local-20261023/confirmation-draft.md)是新的限定页面候选；当前未代用户确认。下一检查点FRONTEND-GATE:G3需I3真实模块完整联调和CORE:S04复审；下一功能UI401可独立按分阶段规程推进。
