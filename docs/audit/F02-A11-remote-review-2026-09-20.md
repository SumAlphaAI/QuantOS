# F02 A11 远程回执检查（2026-09-20）

## 1. 完成概况

用户已通过 GitHub Desktop 人工推送；在已登录 GitHub 页面确认 `main` 的 push 运行绑定完整 SHA `15727feee3018de6f5dc97621241319bea505552`（2026-09-20 16:38，Asia/Shanghai）。本轮只读检查 Actions 和仓库规则，修复失败原因后生成本地提交，再交由人工推送。**A11 保持 OPEN**，不将兼容性工作流绿色状态当作完整验收。

证据来源为已登录 GitHub 的运行摘要、展开日志、设置页，以及下载的 F01 冷启动机器回执。下表页面摘录与下载文件分开记录；F01 回执不能替代 F02 正式签名制品回执。

## 2. 运行明细

| 工作流 | 同 SHA 运行 | 结果 | 验收解释 |
|---|---|---|---|
| Frontend Baseline #32 | [35500118075](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500118075) | FAIL，1m50s | Web build smoke 要求 Next.js 15.5.23，与锁文件 15.5.24 不符；后续步骤未执行 |
| QuantOS Compatibility #53 | [35500118034](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500118034) | SUCCESS，3m35s | Chromium/Firefox/WebKit 各 Terminal 24 passed、3 skipped，Website 各 18 passed；共 126 passed、9 skipped，视觉验收未完成 |
| QuantOS CI #89 | [35500117978](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500117978) | FAIL，13m29s | Test workspace 中 runtime-gateway 两个环境依赖断言失败；verify-download 跳过，F02 artifact 未产生 |
| F01 Clean Room #47 | [35500118019](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500118019) | IN_PROGRESS（16:54 Asia/Shanghai） | clean-room job 成功，已下载同 SHA 回执；reproducibility job 尚在运行，不计 PASS |

本轮 [失败日志](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500117978/job/106050279794#step:26:545) 确认两个相同断言失败；覆盖率、许可证/SCA、数据库、打包、签名步骤未执行，归档提示 `No files were found with the provided path: artifacts/f02/`，无正式下载验签回执。

历史定位证据单独记录：[QuantOS CI #88](https://github.com/SumAlphaAI/QuantOS/actions/runs/35187783721/job/105093474978#step:26:545) 属于 `7396ccd0b37afc6fbfebff4228fc3927764cdf9c`，不能充作本轮通过回执。其 `Test workspace` 中 runtime-gateway 两个测试均在 `assert!(result.is_err())` 失败。

下载的 `f01-clean-room-evidence.zip` SHA-256 为 `ac08c6da2bb3def6de0660f8239eddc09f39f545374158a22d433645441b9337`，与 GitHub artifact 页面一致；内部 `f01-clean-room.json` 的 `status=PASS`、source commit 和 run ID 均匹配。该单次冷启动回执的 `reproducible=false`，不代表三次可重复构建已通过。

## 3. 问题、风险与本轮修复

| 优先级 | 模块 | 表现与影响 | 状态及处理 |
|---|---|---|---|
| 中危 | PRE-03 版本门禁 | 安全升级遗漏硬编码版本，阻断整个前端工作流及后续性能/E2E 检查 | 本地已同步为 15.5.24；增加 Terminal/Website 旧版和跨大版本漂移负向测试，等待新 SHA CI |
| 中危 | runtime-gateway 测试 | 假定 127.0.0.1:5432 的 PostgreSQL 不存在；CI 启动服务后连接成功，导致测试误报并阻断后续供应链步骤 | 改用格式无效的 URL，精确断言 AuthError::Url / PgRuntimeError::Url，错误在网络连接前产生；生产代码未改 |
| 中危 | 平台视觉基线 | 三浏览器各跳过 3 项，Linux 平台缺少对应基线；工作流成功不能证明视觉回归通过 | OPEN；需相同 Linux/浏览器/字体环境生成、人工审阅并提交基线，再执行无跳过验收 |
| 中危 | required checks | Rulesets 和经典分支保护均未配置，失败检查无法提供要求的主干保护证据 | OPEN；管理员处理套餐与规则配置后提供只读回执 |

[Rulesets 页面](https://github.com/SumAlphaAI/QuantOS/settings/rules) 显示 `You haven't created any rulesets`，并提示该私有仓库须升级组织至 GitHub Team 才会执行规则。[Branches 页面](https://github.com/SumAlphaAI/QuantOS/settings/branches) 显示 `Classic branch protections have not been configured`。本轮未修改设置、套餐、Secrets 或运行状态。

## 4. 验证与下一步

- PRE-03 回归：8/8 通过；保留明确版本要求，旧版 15.5.23 和未批准的 16.0.0 均被拒绝。
- Web 构建冒烟：PASS，35 个运行契约检查、26 项依赖、2 个构建路由检查；使用本地已有构建输出，不声称是新的远程构建。
- runtime-gateway：2/2 通过，断言具体 URL 错误类型，不依赖端口是否开放。
- 证据文件：[本地验证目录](./evidence/F02-A11-2026-09-20/)。这些结果适用于本轮本地修改；旧 SHA 的 Actions 不能验证新修改。

下一步由人工推送本轮提交，再收集新 SHA 的工作流结果。A11 关闭前仍必须取得主干正式签名的 `f02-download-receipt`（`status=PASS`、同 SHA、`downloadVerified=true`、`formalSignatureVerified=true`）、供应链及数据库回执、完整视觉矩阵、远程负向门禁拒绝与恢复记录、实际生效的 required checks 证据。套餐升级属于管理员决定，本轮不代为购买或调整仓库可见性。


## 5. 后续推进：51ffc1e 已推送，A11 按用户决定保持 OPEN

2026-09-20 16:55 的 main push 为 `51ffc1e8aa179c4c0d342342c6d3556a9c1dab7b`。下列回执不能替代前述 `15727fe`，也不能验证本轮尚待推送的新实现：

| 工作流 | 运行 | 已观察结论 |
|---|---|---|
| Frontend Baseline #33 | [35500904518](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500904518) | SUCCESS，3m7s；上一轮 Next.js 版本断言修复生效，但 Terminal 仍 24 passed / 3 skipped |
| QuantOS Compatibility #54 | [35500904511](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500904511) | SUCCESS，3m23s；三浏览器共 126 passed / 9 skipped，完整视觉验收仍未完成 |
| QuantOS CI #90 | [35500904510](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500904510) | FAILURE，15m6s；TypeScript coverage 错纳第二期 Desktop 测试，无法解析 @sumalpha/platform；verify-download 跳过，未取得正式签名回执 |
| F01 Clean Room #48 | [35500904502](https://github.com/SumAlphaAI/QuantOS/actions/runs/35500904502) | 已触发；未在本轮归档其最终机器回执 |

用户明确选择“暂不升级，保留 A11 开放”。Ruleset 仍受当前私有仓库套餐限制，签名 Environment 尚未配置。自动审批拒绝创建 `f02-signing`（原因：持久化仓库设置变更授权不足）；本轮未绕过审批、未写入密钥、未变更套餐或规则。

本轮完成可提交的准备工作：

- 签名独立为 `sign-main` / `verify-download-main`，仅 main push 使用受分支限制的 Environment；PR 构建/下载无签名凭据；签名前只读校验已存在的精确 main 分支策略。最终 `verify-download` required check 拒绝上游 skipped/failure。
- Linux 视觉门禁要求 Chromium/Firefox/WebKit × 4 页面共 12 张基线；移除缺基线 skip；正常比较与候选采集均固定 Ubuntu 24.04。
- 新增只读仓库权限的候选采集 workflow，以及 SHA/图片哈希校验、过期渲染输入拒绝、人工审阅后导入工具。候选产出不计验收；需下载审图、本地提交、人工再推送并比较通过。
- 修复 `vitest.coverage.config.ts` 将第二期 Desktop 纳入 Web 覆盖率的范围错误：显式匹配 apps/website、apps/terminal 和共享 packages；保持原 80% 行覆盖率门槛，避免依赖本机残留 Desktop node_modules。
- 提供无 bypass、main 目标、8 项 required checks 的本地规则草案，未应用。具体设置与人工交接命令见 [运行手册](../runbooks/f02-supply-chain.md#a11-补齐流程2026-09-20本轮实现待人工推送)。

本地验证：新增 A11 门禁 6 项 + PRE-06 回归 7 项全部通过；Web 覆盖率 106/106 测试通过、行覆盖率 90.92%（SSE 回环监听获准后复验）；macOS Chromium 3 项视觉测试通过（0 skipped）；现有 5 张已跟踪图的清单/哈希检查通过。Linux 完整性检查按预期退出 1，逐项报告 12 张缺失基线，证明未将缺口静默放行。脚本语法、Playwright 用例发现、开发计划结构及 diff 检查通过。证据见 [准备验证目录](./evidence/F02-A11-preparation-2026-09-20/)。

验证限制：扩展运行原 F02 套件时 7 项通过，真实 Gitleaks 用例因本机缺少固定扫描器失败；终端下载未完成后已中止，官方发布包在浏览器也无法下载。未将该用例标为通过；下一次 GitHub CI 必须重新通过完整 `make f02-check`。本机没有 Linux 容器运行时，未伪造或改名生成 Linux 基线；正式签名和有效分支保护仍为 NO RECEIPT。

当前下一动作：人工推送本轮本地提交，先取得 `linux-visual-baseline-candidates`；基线入库前正常 CI 明确失败是预期行为。即使视觉比较补齐，套餐与签名环境问题未解决前，A11 仍不得关闭。
