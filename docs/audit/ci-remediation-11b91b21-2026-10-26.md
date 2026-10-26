# 11b91b21 CI 跟踪与修复（2026-10-26）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端 main 和本地基线均为 `11b91b21f31953c156c7f21bf3fd5e3fa146b627`。在 main 完成本轮修复、相关验证和本地提交，不推送；本地工作树结果按实际文件字节绑定，不改绑为新提交 hosted CI 或发布验收。

## 远端结果

该 SHA 的 9 个 push 工作流全部结束：3 成功、5 失败、1 取消。F03、R01、F09 成功。F04 未触发，不记为通过。失败和取消如下：

| 工作流 | 实际阻断 |
|---|---|
| [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759187) | Engine Manager 在 `format!` 参数中对已实现 Display 的 JSON Value 调用 to_string，严格 Clippy 拒绝 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759210) | 同一 Clippy 错误，发生在隔离源码 lint 阶段 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759137) | 两张 P07 Chromium Darwin PNG 的当前字节与视觉清单 SHA-256 不一致；verify-download 正常传播上游失败 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759159) | 三个浏览器 job 均被同一清单错误阻断，尚未进入浏览器比较 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759194) | A2 live-last-factor mutation 没有执行到预期业务断言，门禁正确拒绝 |
| [Visual Baseline Candidates](https://github.com/SumAlphaAI/QuantOS/actions/runs/40324759319) | CANCELLED；平台注释明确为超过 20m0s 上限，取消时仍在安装 Ubuntu 浏览器依赖 |

原始 job、终态、失败日志、候选取消全文和平台注释均保留；取消未记为 PASS。

## 修复

Engine Manager 移除 JSON Value 在格式化参数中的冗余 to_string，直接使用同一 Display 实现。保留请求指纹组成、有效期、幂等和路由权限规则，没有添加 lint 豁免。

P07 两张 1672 宽明暗报告图在 `1f3c8725bbd3f512938add4dab52363c380825d8` 已有意更新，原 S04 审计保留了旧图、原摘要和新旧比较，但当前视觉清单遗漏同步。复核两组原图和新图，确认现有导航、比例格式及按实际成交 bar 绘制的成本曲线与原 S04 记录一致；只更新这两个当前 manifest entry 的摘要和适用范围。所有 PNG 字节、其余 140 个 entry、容差及历史证据均不变。两张图的原始版本继续由原审计和 Git 历史保留。

A2 的生产 BFF 库测试通过 `#[path]` 引入 `services/execution-gateway/tests/x3_service.rs` 及其 golden fixture。mutation 工具的缩减工作区只复制 BFF、crates 和 migration，遗漏该目录。本地复现了同一阶段失败，日志明确为文件缺失导致编译失败。现复制 execution-gateway 的 tests 目录，继续使用离线缩减锁、固定 package identity/checksum 和全部 9 个实际 mutation；没有排除 X3 测试或把编译错误当作业务拒绝。前端工作流同时归档完整 mutation 日志、receipt 和 lock-pruning 日志，修复原先仅归档 semantics 的诊断缺口。

候选任务日志显示 Ubuntu 镜像下载 111MB 用时 18min21s，随后安装期间触及整个任务的 20 分钟上限；平台注释确认时间预算耗尽。将任务预算调整为有限的 45 分钟，为依赖安装和后续候选捕获留出时间。三个浏览器安装、来源约束、只读仓库权限和候选人工复核要求保留。没有把增加预算视为远端安装或候选生成已成功。

## 本地验证

| 范围 | 结果 |
|---|---|
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` | PASS；覆盖原 F01 lint 阻断范围，无豁免 |
| `cargo test --locked --offline -p quantos-engine-manager` | 55 PASS，无失败或忽略；包含实际 Python worker、幂等、拒绝和恢复测试 |
| `pnpm check:bff-fe-001` | PASS；20 operations，实际 live policy 8、reference provider 17、Web consumer 29 项测试通过 |
| A2 结构负向与 F09 ledger 探针 | 27 PASS |
| 全部 A2 实际 mutation | 9/9 被预期执行断言拒绝：4 reference、5 live policy；每项 exit 101、无 signal/error，测试名称与日志摘要匹配 |
| mutation 缩减锁证明 | PASS；330 个 scratch package identity/checksum 均来自原 353 个 root package；离线解析，根锁字节不变 |
| Linux、Darwin 视觉清单实际入口 | 均 PASS，142 entries；路径、尺寸、字节摘要，不冒充跨 OS 浏览器验收 |
| 新 Terminal/BFF 构建和 P07 Chromium | PASS；3 scenarios、18 次冻结基线比较；无 skip、flaky 或更新截图；客户端 secret 检查覆盖 181 文件 |
| P07 自动 axe | 18 次扫描，0 violations、18 条 incomplete 原样保留；人工屏幕阅读器/原生缩放未执行 |
| 相关候选、来源、签名与 F05/F07 手工策略 | 最终 13 PASS，其中手工数据库策略 6 项 |
| 工作流诊断归档及候选预算静态校验 | PASS；always 归档完整诊断，45 分钟有限预算，来源和浏览器安装规则不变 |

P07 使用一次当前源码 fresh Terminal 构建，随后实际运行 reference BFF、loopback TLS 和现有 P07 浏览器消费者。构建 source/profile digest 在最终源码上复核一致，记录 buildId、全部导出文件和 BFF 二进制摘要。浏览器执行 `--update-snapshots=none`，保留原始 JSON、截图、axe 与网络来源记录；这是本机 Chromium 和受控 reference 范围，不是 Linux、真实身份或数据库验收。

原远端失败、修改前 A2 缺文件复现及原取消均独立保留。没有重跑完整 F01 三轮构建、完整 F08 覆盖率或整条阶段依赖闭包，也未提升 S04/L01、历史 READY 或目标环境状态。

## 证据与后续

[证据目录](evidence/ci-11b91b21-20261026) 中 `.gz` 可用 `gzip -dc` 无损读取；摘要见 `SHA256SUMS`。`source-binding.json.gz` 绑定五份修复文件和借用的 X3 测试输入；`validation-summary.json.gz` 核对 mutation、锁、浏览器及明确未执行项；`visual-review.json.gz` 绑定原 S04 复核记录。历史文件未改写。

原始证据凭据扫描命中 23 个 generic-api-key：6 个为已重新计算核对的源码 SHA-256，17 个为受控 fixture 输出的幂等键 SHA-256，均非授权凭据。原命中报告保留，逐项来源见 `secret-triage.json.gz` 和 `source-digest-triage.json.gz`；仅本次原始证据扫描使用精确文件/行 fingerprint 临时列表，复扫无剩余命中。仓库 Gitleaks 规则及 ignore 文件没有修改，暂存和提交另按原规则扫描。

F05/F07 在该 SHA 的完整工作流清单中均无运行，仍仅允许 workflow_dispatch、确认默认 false 并要求 `QUANTOS_MANUAL_F05_F07=1`。本轮未连接真实数据库、启动本地数据库、修改 secrets、推送或发布。

新提交 hosted CI、Linux 三浏览器重放、Linux 候选生成、完整 F01/F08、真实数据库/IdP/venue、全量联调和发布验收均为 `NOT_RUN`。下一步为用户推送修复提交后，跟踪同一新 SHA 的五个失败入口、候选生成和后续步骤。
