# FE:UI-P08 交付报告

任务：I4 Portfolio 与 Risk 高保真页面。仅修改 QuantOS，直接 main 开发/本地提交，未使用生产凭据、推送或部署。

来源基线 `40d89e2a`；实现 `c3a4380f`、可访问性/状态修正 `3969466d`、最终源码冻结 `4ed8a29506774812f265ce442ca6049d34faf020`。最终证据提交仅封存结果/文稿，不把证据提交冒充已构建源码。完整文件列表见 changed-files.txt。

## 变更

- `apps/terminal/app/portfolio/workspace.tsx`、`workspace.css`、`p08-components.tsx`：按P08设计实现主区/风险栏、六卡、权益/仓位/敞口、规则引用详情和实际风险观察、告警、视图保存、共用 DangerConfirmDialog；明暗/响应式、移动焦点和常驻Kill状态、加载/空/失败/陈旧/拒绝/恢复。
- `apps/terminal/src/portfolio/p08-presentation.ts`：严格路由/当前规则绑定、只存偏好、保持精确值的过滤排序、最多20条真实快照观察；`runtime.ts`：流错误安全解析关联ID，沿用UI501全部敏感边界。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes{,.test}.mjs`：只允许 `/risk/rules/UUID` 映射风险导出文档，无泛化SPA兜底；保留既有资源族回归。
- `apps/terminal/tests/ui-p08.test.ts`、`tests/e2e/ui-p08.spec.ts`、`tests/e2e/fixtures/ui-p08-reference.ts`、`playwright{,.ui-p08}.config.ts`：16个P08呈现单元、15个实际参考浏览器用例、18组视觉/axe/geometry，负面探针单独标记。
- `scripts/ui-p08-review{,.test}.mjs`：冻结输入/设计稿/二进制/构建/原始命令日志/网络/截图、拒绝伪造/篡改/重试/阶段提升，复核当前源码与范围。
- 前端执行计划、操作说明及本证据目录：同步状态、数据缺口、命令结果、风险与下一任务；`.gitattributes`仅豁免具体不可变失败证据空白，不改原字节。

## 测试命令与结果

`node scripts/ui-p08-review.mjs --run docs/audit/evidence/ui-p08-local-20261023/attempt-03`：13组命令按预期退出。Vitest127；Rust C06 20、C16 1；Node gate/路由/真实静态宿主20；Chromium15，无重试/跳过；18组明暗/1672/1024/390视觉扫描零axe违规。类型、变更范围ESLint、静态构建、client-secrets、计划结构检查通过。`--verify`重放输入/原始日志/产物哈希通过，初始失败和上一候选通过原范围保留。

有界工程Gate `PASS_P08_REFERENCE_FUNCTION`。开发状态IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION命令预期拒绝，下一UI-502 DEVELOPMENT入口允许。

## 未决风险

C06没有净资产估值/历史权益/分项PnL/敞口单位/集中度杠杆阈值/完整规则定义和历史，C01没有细分风险角色能力；这些项保持来源不可用，不伪造图表/签名/授权或声称目标验收完成。参考BFF/固定测试MFA与TLS/身份/CORS替代不证明真实目标身份、数据库/RLS/事务、真实组合风险源、持久恢复或长期SSE；受控报告/相关订单引用缺失则禁用。

Axe 12组/120个非文本导航图标检查incomplete，人工读屏/native200%、Firefox/WebKit/跨OS、远程同SHA CI、性能容量长稳、完整I4/RELEASE仍NOT_RUN。未知意图只驻内存，离线/撤权/关闭清除，恢复须先核查当前状态/审计再操作，不自动重放。

下一可执行任务：**FE:UI-502：Proposal 与风险评估**。
