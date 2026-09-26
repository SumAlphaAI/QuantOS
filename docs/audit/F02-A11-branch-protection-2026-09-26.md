# F02-A11 required checks 分支保护验收

> 日期：2026-09-26。仓库：SumAlphaAI/QuantOS（public）。本次依据用户授权修改规则并推送隔离验收分支；未升级套餐。
> 最终结论：**F02-A11 CLOSED / F02 ACCEPTED**，新main同SHA完整回执见 [验收收尾](./F02-A11-main-acceptance-2026-09-26.md)。以下保留分支保护配置与诊断过程，早期OPEN状态均为历史记录。原始证据见 [证据目录](./evidence/F02-A11-2026-09-26/README.md)。

## 一、任务完成概况

本次关闭范围是 F02-A11 的有效 required checks、失败阻断与恢复证据缺口。所有故障注入及恢复合并只面向隔离分支 `codex/f02-a11-protected-target`；配置修复与最终报告位于独立主线收尾分支。

初始主线基线为 `ac73a95a758cc95385b69e9d6f9376cef4a2af0b`。正式 [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/36240334477) 已通过，正式签名/下载复验、SCA、许可证与隔离数据库证据均绑定此 SHA。但独立 [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/36240334483) 的 reproducibility 检查失败，当时该基线不能表述为 8/8 全绿或 F02 全量 ACCEPTED。

## 二、完成情况明细

### 2.1 规则配置

规则集 `23727075` 在整改前只有 deletion、non_fast_forward，存在 OrganizationAdmin/always bypass。整改后保留两项规则，并新增 strict required_status_checks；全部检查绑定 GitHub Actions App `15368`，`bypass_actors=[]`，当前管理员 `current_user_can_bypass=never`。

| required check | 来源 |
|---|---|
| verify | GitHub Actions |
| verify-download | GitHub Actions |
| frontend-baseline | GitHub Actions |
| Web contract (chromium) | GitHub Actions |
| Web contract (firefox) | GitHub Actions |
| Web contract (webkit) | GitHub Actions |
| acceptance (clean-room) | GitHub Actions |
| acceptance (reproducibility) | GitHub Actions |

测试期间将同一个规则集临时扩展到隔离目标。`main-effective-probe.json` 与 `target-effective-probe.json` 完全一致；不使用另外一套较弱规则。验收后已移除临时 scope，最终规则只覆盖 main，8 项检查、strict 与零 bypass 保持不变。

### 2.2 失败与恢复

隔离 [PR #3](https://github.com/SumAlphaAI/QuantOS/pull/3)：

- 故障 SHA：`67cf71f40d276d50db2d976988a20ecdbac886df`。真实 verify 与 verify-download 失败。
- 2026-09-26 12:07:05 UTC，对固定故障 head 请求合并，GitHub 返回 **HTTP 405**：`8 of 8 required status checks have not succeeded: 2 failing.`
- GitHub rule suite `4239923099` 明确记录 `required_status_checks=fail`；deletion/non_fast_forward 均 pass，排除因其他规则或冲突拒绝的假阳性。
- 首次恢复 SHA `2ba9d44e68a1337f08e47ae2925897eb72955022` 因后述 Playwright 历史截断问题失败；失败证据保留，不接受该 SHA。
- 完整修复恢复 SHA：`577c2613f19dcf499eb047330f99dad9a548ec9e`。该 SHA 的 CI workflow 与主线一致，已移除全部临时故障及诊断步骤；增加两处 Playwright 元数据修复。[CI 36241816324](https://github.com/SumAlphaAI/QuantOS/actions/runs/36241816324) 成功，8 项 required checks 全部 success。固定此 head 合并到隔离目标成功，最终合并 SHA 为 `1ca34c70a0c5f25c09fec11a6bd46d7ff79ca841`，rule suite `4240103004` 明确记录 required_status_checks=pass。

PR checks 的 head SHA、GitHub 临时 merge SHA `c9e02c0b5c2c35fa62e2da745e02eab9566ee9f4` 与最终合并 SHA 分别记录。PR 的下载回执是完整性校验，不替代 main 的正式签名。故障与恢复是不同提交，不能伪写成同一源码回执。

## 三、问题清单及风险分析

### 3.1 本次修复：Playwright 破坏密钥扫描所需历史

- 模块：Terminal/Website Playwright 配置、F02 PR Secret scan。
- 表现：Playwright 1.62.1 默认 Git diff 报告采集执行 `git fetch origin <PR base> --depth=1`。完整检出被转为浅历史，Gitleaks 把 main 基线当作新根提交，原有两项精确历史指纹失效。
- 实证：前置扫描约 14.47 MB、0 告警；浏览器运行后约 26.89 MB、2 告警。脱敏诊断定位到现有公开合成 JWT 及固定幂等键夹具，均错误归属 ac73a95 基线。
- 修复：两份 Playwright 配置使用 `captureGitInfo: { commit: true, diff: false }`。保留提交元数据、全部测试、视觉阈值、Gitleaks 规则及原有精确豁免。
- 验证：新集成回归用真实 Git/Playwright 和本地 file remote 验证旧配置会截断历史、两份实际修复配置均保持完整两提交历史；接入 `make f02-check`。本地 F02 回归 **15/15 PASS**。

### 3.2 历史发现：旧主线 Terminal 可重复构建失败（现已修复）

- 等级：中危；模块：F01/F02 Web 制品可重复构建。
- 源码：ac73a95；run `36240334483`，attempt 1。
- 表现：三次构建第 1 次与第 2/3 次的 Terminal JS chunk 摘要不同，并传导至 HTML/RSC 引用；Rust、Python 及其他工作区输出一致。
- 影响：该旧基线 `acceptance (reproducibility)` 为 failure，阻止完整主线验收。不能用另一 SHA 的绿色运行覆盖该失败，也不能删除该 required check。
- 证据：`main-reproducibility-failed.json`、`main-reproducibility-differences.json`、`main-clean-room-first.json`。
- 本次不把未定位到根因的构建差异解释为网络抖动，不以反复重跑替代整改。

### 3.3 前轮诊断与证据留存修复

同一原失败 SHA 的 Linux 六次 Web 诊断、固定输入的 Linux 4096 次压缩和新增正式 F01 运行均未再捕获差异，不能据此认定根因已修复。已修复正式 Gate 仅保留摘要、无法比较原始字节的证据缺陷，新增 4/4 故障回归；F02 回归再次 15/15 PASS。详细源码绑定、证据和关闭条件见 [可重复构建诊断报告](./F02-A11-reproducibility-diagnosis-2026-09-26.md)。当时 A11 整体仍 OPEN；最终已关闭，见本文顶部收尾报告。

### 3.4 根因已确认并针对性修复

已取得与历史两组 SHA 精确一致的真实 chunk，定位到 callback 入口与 UI 的短模块 ID 冲突。两份 Next 配置使用固定八位空间并在冲突时失败；真实编译回归5/5通过，完整 Terminal 在两种冲突顺序下61/61文件一致。已完成新 main 同SHA远程收尾；详见 [根因与修复报告](./F02-A11-module-id-root-cause-2026-09-26.md)。

## 四、整改与维护建议

1. 真实故障阻断、恢复隔离合并、此次正常main合并均有服务端规则审计，保留原始证据。
2. 当前规则仅覆盖main，strict、8项App来源检查和零bypass不变。
3. Playwright历史保全及模块ID冲突修复已通过PR #4合入；新main `bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f` 的全部检查及正式下载验签成功。
4. 未来变更需取得自己的源码回执；不删除旧失败，不关闭原有Gate。
