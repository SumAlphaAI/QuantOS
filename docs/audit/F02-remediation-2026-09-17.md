# F02 整改与复验记录

> 日期：2026-09-17。基线：[F02 全面复审报告](./F02-comprehensive-review-2026-09-17.md)，原审计源码 `daf81d2f057c6b0c2d8c368f0c2b3930de91c704`。
> 状态：本地整改与复验完成；原问题 **11/12 已关闭（91.7%）**，A11 仍开放。2026-09-20 已执行远程 CI，但存在失败；主干正式制品仍为 `NO RECEIPT`。最新状态见 [A11 远程检查](./F02-A11-remote-review-2026-09-20.md)。
> 修复源码提交：`bb76f99255cc13ff9bbaca62f70dbad3c22d9617`。以下 2026-09-17 测试统计绑定该源码；2026-09-20 新代码修复和远程结果另见最新检查记录。

## 一、任务完成概况

本轮按原 12 个问题补齐真实 secret 扫描、数据库重建及权限隔离、迁移内容与目录漂移、全量许可证/SCA、到期豁免裁决、Proto 历史基线、完整运行时打包和下载验签入口。用户分别批准精确版本 LGPL 构建工具的有条件准入，以及 Python 3.12 基线升级。未新增漏洞豁免、未使用生产凭据、未推送或发布。

问题关闭统计：高危 **6/6**，中危 **5/6**，阻塞/低危均为 0。A01–A10、A12 的实现与本地复验已关闭；A05 的远程主干交付部分统一保留在 A11，不据此宣称发布成功。

原 24 项严格检查点复核：**PASS 20、PARTIAL 3、NO RECEIPT 1，完成率 83.3%（20/24）**。C06（完整兼容/视觉）、C18（远程主干交付）、C23（真实远程 CI 破坏运行）为 PARTIAL，C24 为 NO RECEIPT，其余为 PASS。三项量化验收中“高危为零或有效豁免”通过，其余两项本地实现通过但缺远程回执，完整通过率 **1/3**。

证据入口：[summary.json](./evidence/F02-remediation-2026-09-17/summary.json)，逐文件记录 SHA-256。DB、SCA、制品、门禁在干净修复提交上复验；其他测试在提交前相同实现/锁文件上运行。

## 二、逐项整改明细

| ID | 原等级 | 模块 | 修复内容 | 验证方式 |
|---|---|---|---|---|
| A01 | 高危 | Secret | 加载默认规则、固定 Gitleaks 8.28.0 并校验下载 SHA；历史合成 JWT 只豁免精确 commit/path/rule/line 指纹 | Git 历史扫描；正常 fixture 通过，真实扫描器拒绝合成 GitHub/Slack token |
| A02 | 高危 | RLS | 逐迁移跟踪 ENABLE/FORCE/policy 最终状态；索引不能充当策略 | 静态正负对照及 PostgreSQL 目录检查 |
| A03 | 高危 | CI/数据库 | 必跑临时 PostgreSQL、两个独立重建库、双用户双租户、匿名与写入拒绝 | 独立本地 PostgreSQL 17.10 执行全部迁移及权限测试 |
| A04 | 高危 | Drift | ledger 保存 SQL SHA；真实 tables/columns/constraints/indexes/policies/routines/triggers 对照；禁止同库 URL 别名自比较 | SQL 内容、列、索引、RLS 变异及恢复验证 |
| A05 | 高危 | 制品 | 收集全部 Rust、Python、一期 Web 输出；manifest 绑定全部文件与 SBOM；独立下载 job 验签验完整性 | 包完整性、错误 SHA、缺失、多余、篡改及 Web 原生文件拒绝 |
| A06 | 高危 | 漏洞依赖 | Next 15.5.24、sharp 0.35.4；补充修复 dev/build 与 Rust/Python 扫描发现的漏洞 | 三生态原始扫描与统一裁决 |
| A07 | 中危 | 许可证 | pnpm 全锁文件；Python 所有激活依赖组；SPDX AND/OR 语义；未知许可证拒绝 | 完整清单、精确许可文件 hash、条件审批与打包限制 |
| A08 | 中危 | Proto | PR base SHA、push before SHA；同 HEAD/空基线失败 | 独立 Git fixture 删除字段后 Buf breaking 拒绝，恢复后通过 |
| A09 | 中危 | 豁免 | 三扫描器统一按生态/包/版本/漏洞/期限裁决；工具故障不可豁免 | 精确匹配、错误版本、错误 ID、过期与无效日期测试 |
| A10 | 中危 | 负向测试 | 先正常对照，再明确诊断拒绝，恢复后通过；真实 Gitleaks/Buf/PostgreSQL | F01 16 项 + F02 8 项；DB 另有真实变异测试 |
| A11 | 中危 | 外部验收 | 增加下载制品复验和带 SHA/run URL 的机器回执；本地执行覆盖率与浏览器 | 远程已运行但未完整通过；正式签名、required checks、视觉基线仍开放，最新矩阵见 2026-09-20 记录 |
| A12 | 中危 | 扫描范围 | Node 移除 prod-only；Python 运行/dev/build/security 均扫描；Rust 保留 dev | 完整锁文件范围扫描 |

### 实际验证结果

| 检查 | 结果 | 证据 |
|---|---|---|
| Rust fmt/Clippy/全工作区测试 | 186 passed、1 ignored；退出 0 | [日志](./evidence/F02-remediation-2026-09-17/rust-validation.log) |
| Rust 覆盖率 | 行 92.75%、region 92.38%，达到 ≥90%/≥85% | 同上；region 是现行稳定工具链分支代理 |
| Python Ruff/Pyright/pytest | 91 passed；覆盖率 90.98% | [日志](./evidence/F02-remediation-2026-09-17/python-validation.log) |
| Web lint/typecheck/unit | 工作区 115 tests passed；覆盖率套件另有 107 tests，行覆盖率 90.89% | [日志](./evidence/F02-remediation-2026-09-17/web-validation.log) |
| 浏览器 | Chromium 27 passed；Firefox/WebKit 49 passed、5 skipped | [Chromium](./evidence/F02-remediation-2026-09-17/chromium.log)、[矩阵](./evidence/F02-remediation-2026-09-17/firefox-webkit.log) |
| 真实门禁与锁文件 | 24/24 负向/对照测试通过；Gitleaks 122 commits 无未豁免命中；四类锁有效 | [日志](./evidence/F02-remediation-2026-09-17/gates.log) |
| Proto / BFF 契约 | 真实 Buf 历史基线、生成检查及 11 项 BFF 契约负向测试通过 | [日志](./evidence/F02-remediation-2026-09-17/contracts.log) |
| PostgreSQL 17.10 | 36 表基线、独立重建、回放、同库别名拒绝、漂移/RLS 变异、跨身份访问通过 | [回执](./evidence/F02-remediation-2026-09-17/database.json) |
| 许可证 | Rust 固定扫描器通过；Node 726 个锁包；Python 42 个本平台激活依赖 | [日志](./evidence/F02-remediation-2026-09-17/licenses.log) |
| 全量 SCA | Node high/critical=0；Python/Rust 已知阻断漏洞=0；豁免=0 | [回执](./evidence/F02-remediation-2026-09-17/sca-npm-pypi-cargo.json) |
| 完整制品 | 7 Rust、8 wheels、7 Web/package 输出；共 234 文件、25,049,687 字节；SBOM 含 1,125 锁包 | [manifest](./evidence/F02-remediation-2026-09-17/release-manifest.json)、[构建日志](./evidence/F02-remediation-2026-09-17/package.log) |
| 签名与篡改 | 本地测试密钥 HMAC、独立本地复制复验、payload/manifest 篡改及错误密钥拒绝，恢复通过 | [回执](./evidence/F02-remediation-2026-09-17/local-artifact-verification.json)；不是远程下载/正式主干签名 |

## 三、问题与风险边界

- Node 还存在 3 条中危告警：`uuid@9.0.1`（GHSA-w5hq-g745-h8pq）、`vitest@3.2.6` 与 `@vitest/mocker@3.2.6`（GHSA-82fw-gwwq-j7x9）。现行策略只阻断 Node high/critical，未将这些告警隐去或声明为零；后续需对 uuid ≥11.1.1、Vitest ≥4.1.11 的主版本兼容升级单独验证。
- A11 仍开放。2026-09-20 已核实人工推送、运行及规则设置；CI 存在失败，尚无主干正式制品下载验签回执。
- Firefox/WebKit 5 项现有视觉测试因缺基线跳过；功能测试通过也不代表真实 Safari 发布验收。
- 旧数据库 ledger 缺少 SHA 时拒绝；不得以当前 SQL 自动补写而冒充历史证据。迁移流程见 [运行手册](../runbooks/f02-supply-chain.md)。
- 本地数据库是独立 PostgreSQL + 最小 Supabase auth fixture；不是托管 Supabase 实例回执。
- LGPL 仅适用批准的精确构建包版本；发布包禁止 Web 原生模块。切换动态图片服务器或升级相关版本必须重新审查。
- Python 升级后，F01 原 3.9 冷启动回执只适用原源码；不将旧回执重新标注为本次提交的验收。

## 四、后续整改与验收

1. 已完成本地源码提交、测试、制品签验和绑定源码的证据归档；本地 Gate 为 PASS，F02 整体 Gate 为 PENDING_EXTERNAL_ACCEPTANCE。
2. 由人工通过 GitHub Desktop 推送本地提交，随后 GitHub Actions 执行；代理只读收集同 SHA 的成功运行、覆盖率、兼容矩阵及下载复验回执。
3. 补齐缺失平台视觉基线、核对 required checks 和主干签名配置；证据齐全后复审 A11，再决定 F02 整体验收。

## 2026-09-20 流程状态更新

用户确认：所有代码均由人工通过 GitHub Desktop 推送。此前待推送的 `15727fe` 已于 2026-09-20 在 GitHub 验证；当前状态为 **REMOTE_REVIEW / FIX_VALIDATION**，工作流失败修复后再次交由人工推送，A11 保持 OPEN。按“本地修复与提交 → 人工推送 → GitHub Actions 执行 → 收集回执 → 关闭 A11”执行，不再将自动推送授权列为前置条件。

推送前的流程文档提交仅完善本地交接清单，当时没有重新执行三语言测试或产生远程验收结论；原 2026-09-17 证据保持原适用范围。本机终端只读访问因缺少认证失败，未认证 Actions API 返回 404，均不用于判断远程运行状态。完整交接清单见 [F02 运行手册](../runbooks/f02-supply-chain.md#人工推送与-a11-交接流程2026-09-20-确认)。

## 2026-09-20 远程检查更新

本地历史验证数字及 20/24 检查点统计保留其原始范围，不据此提高远程完成率。已发现并本地修复 PRE-03 Next.js 版本断言、runtime-gateway 测试依赖数据库不可用的问题；兼容性工作流共 126 passed / 9 skipped，Rulesets 与经典分支保护均未配置。详细运行链接、状态及后续步骤统一见 [A11 远程检查记录](./F02-A11-remote-review-2026-09-20.md)。

后续：`51ffc1e` 已人工推送，前端修复已在远程成功运行；用户决定暂不升级套餐，A11 保持 OPEN。本轮修复 Web 覆盖率误纳 Desktop，并补充签名隔离、Linux 候选采集、缺基线阻断及规则草案，均不等同远程验收，详见最新 A11 记录第 5 节。

最新推进：`6179d22` 已人工推送，候选采集及F01双门禁通过；12张Linux基线已审阅导入。管理员明确授权后已保存main-only签名环境及8项GitHub Actions来源Ruleset，密钥待用户录入，Ruleset仍受套餐限制不执行。新SHA比较、正式验签和有效分支阻断/恢复尚缺，A11 OPEN，详见远程记录第6节。
