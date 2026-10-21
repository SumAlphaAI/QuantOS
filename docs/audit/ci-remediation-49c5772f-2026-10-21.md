# 49c5772f 远程 CI 修复（2026-10-21）

基线：`49c5772f18f8be3b10eae42a9243336443f53199`。本地从干净 main 开始，仅提交本轮修复；未推送、部署或执行数据库操作。实际查询到 5 个失败工作流，部分共享同一根因。原始失败及后续暴露的失败均保留，不改写历史验收记录。

## 远程失败与修复

| 工作流 | 同 SHA 运行 | 原始失败与处理 |
|---|---|---|
| F01 Clean Room | [39559053737](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559053737) | 隔离源码检查的 cargo fmt 拒绝 live/settings.rs 和 auth_settings_provider.rs；按固定 Rust 工具链格式化两处排版。 |
| F08 Engine CI | [39559055074](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559055074) | 相同 Rustfmt 错误；共用上述修复。 |
| Frontend Baseline (FEP-0) | [39559054069](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559054069) | A2 当前盘点仍为 API 1.12.0 / 132 operations / 110 schemas，结构检查阻止执行语义测试，进而打印整组缺失 proof 错误。当前引用更新为真实 API 1.14.0 / 134 / 113，重新执行三组语义回归，不借用旧缓存。 |
| QuantOS Compatibility | [39559053932](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559053932) | Chromium/Firefox/WebKit 的 Command 与 Security 截图仍使用近期 UI101/UI104 改动前的 Linux 基线。审阅并导入同 SHA Linux 候选，保持原比较阈值。 |
| QuantOS CI | [39559054020](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559054020) | 同一 Chromium 视觉差异提前阻塞主流水线；随后不存在 artifacts/f02 造成额外归档错误。复用视觉修复，并使归档在提前失败且无文件时跳过；成功路径缺失证据仍报错。 |

同 SHA 的 F03、R01、F09 与 Visual Baseline Candidates 为 SUCCESS，仅作为各自原范围结果。

## A2 执行与后续编译问题

current inventory 和 summary 只更新当前契约引用，C01/C17 仍为 20 项，stagingStatus=DEFERRED_TO_FINAL_REVIEW、formalAccepted=false 保持原边界。原 2026-10-03 基线及后续历史报告不改绑为本候选 PASS。

实际 check:bff-fe-001 已运行 8 项 live settings policy 库测试、15 项 auth/settings provider 集成测试和 29 项 Terminal consumer 测试；当前 sourceHashes 与全部 18 个执行输入逐项匹配。随后 test:bff-fe-001 的前 4 个参考 provider 变异被正确拒绝，但第一个 live policy 变异因新 platform 单元测试的 include_str! SQL 输入未复制进临时源码而编译失败。该失败未计作变异拒绝。

变异 fixture 补齐 supabase/migrations 原始源码文件后，9 个变异均在预期业务断言处失败，且无编译失败、超时或信号替代；原锁包身份/校验值子集和根锁不变检查通过。SQL 只被复制/编译，未连接或执行数据库。A2 CI disposition 仍为 DEVELOPMENT / NOT_ASSESSED / admitted=false，不提升为功能准入或正式验收。

## Linux 视觉基线

候选来自 [同 SHA 的 Linux 捕获 39559053847](https://github.com/SumAlphaAI/QuantOS/actions/runs/39559053847)，Ubuntu 24.04、Playwright 1.62.1。现有 import-reviewed 入口核对来源、全部 12 张图片的 SHA256/尺寸及捕获后渲染输入漂移，再更新当前基线。审阅 9 张变化图片：Command 的只读快照/context/risk 呈现，以及 Security/Browser 的当前 scope 导航、身份说明、mock 边界与内部滚动布局，均对应此前 UI101/UI104 源码变更。3 张登录图片字节相同。

本轮未修改任何 Terminal/共享 UI 渲染代码或截图断言，未更新 Darwin 基线，maxDiffPixelRatio 仍为 0.005。旧 Linux 图片字节保留于基线 Git 提交，before/visual-baselines.json 保留旧摘要与尺寸；工程比较基线刷新不代表正式设计确认。

从独立的 compatibility 运行下载实际比较图片，三个 Linux 浏览器的 Command/Security 各含初次与 retry，共 6 个 case、12 张 actual 图片，与本轮相应基线逐像素相同（0 differing pixels）。这是两个既有同源运行的独立像素复核，不是新提交远程 CI 已通过。Browser 设置页新基线另由同源候选及人工工程审阅覆盖。

本地按 CI 公开 mock 参数构建 Terminal：Chromium 全套 34/34 PASS，含现有 Darwin 视觉比较；WebKit 非视觉 31/31 PASS，均 0 flaky/skip。Firefox 本机启动报 sandbox_extension_issue_file_to_process / Operation not permitted 和 RenderCompositorSWGL framebuffer 错误，180s 超时后中断其专属进程树；原始错误上下文和 INTERRUPTED_NOT_PASS 留档，未记作页面断言或 Firefox 本地通过。

## 历史密钥扫描

提前复验发现 49c5772f 的历史扫描有 4,876 条 generic-api-key 命中，当前远程流水线尚未抵达该步骤。逐项核验后确认：4,830 条是历史 path→SHA256 清单值，对应 436 个真实 Git blob，重算摘要全部一致；44 条是一个真实 Git commit ID 的重复引用；2 条是确切的固定 scopeSummary 英文范围说明。共涉及 12 个历史提交、41 个文件版本，均非凭据。

仅追加这些 commit/path/rule/line 精确指纹到 .gitleaksignore；旧指纹原字节保留，.gitleaks.toml 不变，未按目录、key 名称或任意十六进制字符串放行，未改写原始审计字节。复现工具 local/verify-historical-findings.py 读取留存的原始脱敏报告，使用 Git 对象独立核验，未知类型或任何摘要不一致即拒绝；详单压缩留存。

复验 724 commits / 1.76 GB：0 leaks。实际 Gitleaks 正向/泄漏控制与历史例外拒绝测试通过，新增相同历史清单路径的未来凭据探针仍被拒绝；2/2 PASS。该处理不构成对未执行 SCA、部署或生产秘密管理的验收。

## 本地结果与边界

| 检查 | 结果 |
|---|---|
| Rustfmt / F01 工具链与模块预检 | PASS；首次 F01 预检因 uv 缓存沙箱读取限制失败，允许既有缓存访问后 PASS，失败日志保留 |
| A2 实际 provider/consumer 语义 | 8 + 15 + 29 PASS，均 0 ignored/skip；18 个当前源码摘要匹配 |
| A2 门禁负向 / 实际变异 / F09 ledger | 23 PASS / 9 个预期业务拒绝 / 4 PASS |
| Terminal 构建 / Chromium / WebKit | PASS / 34 PASS / 31 非视觉 PASS；Firefox 本地 INTERRUPTED_NOT_PASS |
| 视觉清单 / 独立 Linux 实际截图 | 24 个双平台条目完整；12 张 actual 与 6 个相应 Linux case 基线零差异 |
| PRE06 正负门禁 | 17/17 PASS，含视觉完整性、阈值/预算/断言/跳过探针 |
| F02 归档策略 / 开发计划 / 脚本语法 / diff | 配置检查与静态检查 PASS；归档成功路径仍保留 if-no-files-found:error |
| 历史和新增暂存补丁密钥扫描 | 历史修复前 FAIL、核验后 PASS；暂存补丁结果见证据 |

[完整证据](evidence/ci-49c5772f-20261021/)包含原始远程失败日志（gzip）、当前/旧盘点、同源 Linux 候选收据及工程审阅记录、独立 actual 图片对照、本地实际执行、首次 A2 编译失败与修复后拒绝结果、Firefox 中断、历史扫描 FAIL/核验/PASS，以及源码和证据 SHA256 manifest。候选以所在 Git 提交标识。

本轮 Gate：PASS_LOCAL_SCOPED。完整 F01 clean-room/reproducibility、F08 stable Gate、目标 PostgreSQL/Supabase、完整发布验收和新提交远程 CI 均未在本轮执行。新提交未推送，hostedCandidateGate=NOT_RUN；需推送后核对新同 SHA 托管工作流，不把基线成功、候选截图生成或本机结果提升为新提交远程验收。
