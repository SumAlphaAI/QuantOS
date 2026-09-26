# F02 门禁运行与验收

本地命令均设置 `QUANTOS_SKIP_ENV=1`，不加载项目 `.env`。工具版本以仓库版本文件和 CI 为准。2026-09-17 用户批准将 Python 从 3.9 升级为 3.12，当前固定为 3.12.10；升级全部 8 个 Engine 的版本约束、锁文件、CI、Ruff/Pyright 和测试依赖。F01 历史 3.9 回执仅证明其原源码，不自动覆盖本次升级。

## 2026-09-26 分支保护复核流程

当前 required checks 阻断/恢复验收已通过；F02 整体仍受 ac73a95 的 Terminal 可重复构建失败阻塞，详见 [本次验收报告](../audit/F02-A11-branch-protection-2026-09-26.md)。

用户已授权本次远程配置与推送验收；下文 2026-09-20 的人工推送限制和缺回执状态保留为历史记录。本次不升级套餐。当前仓库为 public，以 API 实际执行结果判断规则是否生效。

- 配置模板：[f02-main-ruleset.proposed.json](./f02-main-ruleset.proposed.json)。8 项检查均绑定 GitHub Actions App `15368`，strict 模式开启、无 bypass；保留禁止删除与强推。
- 读取 `GET /repos/SumAlphaAI/QuantOS/rulesets/23727075` 和 `GET /repos/SumAlphaAI/QuantOS/rules/branches/main`，核对 active、完整检查名称、来源及作用范围；不能仅凭规则保存成功判定验收。
- 在 main 当前 SHA 创建隔离目标，将同一个规则集临时扩展到该分支。通过 PR 注入真实检查故障，使用固定 head SHA 请求合并；必须保存 HTTP 拒绝及 rule suite 中 required_status_checks 的 fail 结果。
- 移除故障、重跑全部 8 项检查，保存每项 success 与实际 head SHA，再合并到隔离目标，保存 merged=true 与 rule suite pass。故障提交不得进入 main；不使用绕过或伪造状态。
- 验收后规则作用域恢复为 main，重新读取实际规则并确认隔离 scope 已移除；主干配置持续生效。
- 主线正式制品下载验签和隔离 PR 的完整性校验分别绑定其源码 SHA；故障与恢复提交必须分别记录，不能虚构为同一 SHA。

## 扫描与失败语义

- `make license-check`：Rust cargo-deny 0.20.2；全部 pnpm 锁包（含 dev/build/其他平台）；Python 所有激活依赖组。未知许可证失败。LGPL 条件见 [批准记录](../adr/20260917-f02-license-intake.md)，不得作为全局准入。
- `make sca-check`：Node 全量依赖阻断 high/critical；Python 所有依赖组及 Rust advisories 阻断已知漏洞。网络错误、解析失败、扫描器缺失均失败。原始报告及裁决位于 `artifacts/f02/`。
- `security/sca-waivers.json` 必须指定生态、包、精确版本、漏洞 ID、责任人、理由和有效期；三个扫描器统一消费，不能豁免扫描器故障。本次不新增漏洞豁免。
- `bash scripts/install-gitleaks.sh` 安装 checksum 固定的 8.28.0；设置 `GITLEAKS_BIN` 后运行 `make quality-gate-self-test`。真实 Git 历史扫描加载默认规则；测试必须先证明正常输入通过，随后按明确诊断确认破坏被拒绝。
- `QUANTOS_PROTO_BASE` 在 PR 使用 base SHA，在 main push 使用 before SHA；缺失、全零或与 HEAD 相同均失败。本地默认 HEAD 的父提交。

## 临时数据库与已有 ledger

CI 必须启动专用 PostgreSQL 17.10 服务，并提供 loopback `F02_PG_ADMIN_URL`。`make f02-db-check` 创建两个随机数据库，执行全部迁移、检查内容 SHA 和目录结构一致性、回放、注入结构/RLS 破坏，并检查双用户双租户访问和匿名拒绝；完成后删除测试库。该测试不代表 Supabase 托管实例验收。

本地有 PostgreSQL server 二进制时：`PG_BIN=/path/to/postgres/bin bash scripts/run-f02-local-db.sh`。脚本创建专用临时 cluster，随机 loopback 端口，退出时停止并清理。不得将业务数据库 URL 当作测试环境。

已有 `schema_migrations` ledger 无 SHA 时故意拒绝，不能自动按当前文件填充或隐式信任历史。旧数据库迁移必须另行核实当时已部署 SQL、备份和独立基准目录，记录批准的基线恢复方案后处理。`db-schema-diff` 要求独立 `QUANTOS_REFERENCE_DATABASE_URL`；仅文件名相同不算无漂移。

## 制品与回执

在干净的已提交源码上运行 `make f02-package`，构建并收集全部 Rust 二进制、8 个 Python wheels、一期 7 个 Web/package 输出、锁文件、NOTICE、许可清单和 SPDX SBOM。`artifacts/release/manifest.json` 包含 commit、tree、工具版本、每个文件的长度和 SHA-256；SBOM 也绑定同一提交。

`make sign-artifacts` 签 manifest，manifest 递归绑定所有 payload；`make verify-artifact-signatures` 验签后核对缺失、多余、篡改文件和 Web 包内禁止的原生构建依赖。主干必须提供 `QUANTOS_SIGNING_KEY` 且要求正式签名；PR 的无密钥 digest 仅是完整性检查。

CI 上传 payload 后由独立 `verify-download-main` / `verify-download-pr` job 下载复验，`verify-download` 聚合实际结果，生成带 SHA、run URL、attempt、签名状态的 `f02-download-receipt`。主干 HMAC 密钥不得写入仓库或本地证据。正式验收还需远程成功运行和 required checks 配置回执；本地通过不能填写远程 PASS，也不自动授权 push 或发布。

## 历史人工推送与 A11 交接流程（2026-09-20 快照）

固定流程：**本地修复与提交 → 人工推送 → GitHub Actions 执行 → 收集回执 → 关闭 A11**。所有代码由人工通过 GitHub Desktop 推送；代理负责本地修复、验证、提交与推送后验收。代理不执行 push，不代操作 GitHub Desktop 上传。2026-09-20 用户另行明确授权持久化设置变更，已按第 6 节回执配置 Environment 与 Ruleset；套餐升级仍未授权。

### 1. 本地修复与提交

- 确认工作区干净，修复、锁文件、测试、文档及证据均已提交。
- 已有修复提交 `bb76f99255cc13ff9bbaca62f70dbad3c22d9617`，本地证据提交 `7396ccd`。本次流程文档提交也应一并人工推送。
- 本地历史测试只适用报告指定源码；后续 Actions 回执必须记录实际推送的完整 SHA，不能把本地修复 SHA 当作远程运行 SHA。

### 2. 人工通过 GitHub Desktop 推送

在 GitHub Desktop 选择 `SumAlphaAI/QuantOS`，核对当前分支及待推送提交，然后由人工执行 Push origin。记录推送的完整 SHA。推送完成后提供 Actions 运行链接或告知已推送，即进入只读回执收集阶段，无需再次授权自动推送。

### 3. GitHub Actions 执行

核对实际推送 SHA 对应的 `QuantOS CI` 和 `QuantOS Compatibility`；不得仅看分支顶端绿色图标。主干制品验收要求 main push 运行成功，PR 的完整性签名不能替代主干正式签名。

如工作流失败：保留失败 run URL、job/step 和日志，回到本地修复与提交，再交由人工推送。缺少签名 Secret、Environment 权限或 required checks 时记录设置缺口，由仓库管理员配置；不得将检查改为可跳过来获取绿色结果，也不要求用户粘贴密钥。

### 4. 收集回执

将回执归档到 `docs/audit/evidence/F02-A11-<验收日期>/`，记录以下内容：

| 回执 | 必须核对的内容 |
|---|---|
| Actions 运行元数据与日志 | 仓库、完整 head SHA、event、branch、run URL/ID、attempt、结论、各必要 job/step |
| `f02-validation-evidence` | DB 重建/隔离/漂移、三生态 SCA、许可证；对应运行和源码，不混用其他 run |
| `quantos-build-artifacts` | 下载文件清单、manifest 与 SBOM 的 SHA、全部 payload 的 digest 校验 |
| `f02-download-receipt` | `status=PASS`、`commit` 等于该 run 的 SHA、`downloadVerified=true`、主干 `formalSignatureVerified=true` |
| 测试与兼容矩阵日志 | 三语言覆盖率、真实负向门禁的拒绝与恢复、Chromium/Firefox/WebKit 结果；逐项处理 skipped 视觉基线 |
| 仓库规则证据 | 当前适用 Ruleset/分支保护及 required checks，注明获取时间；只读取，不擅自更改 |

可通过已认证的只读 API/CLI 或已登录 GitHub 页面获取；若代理无法访问私有仓库，可由人工下载上述 artifacts 和日志供本地核验。未认证 API 的 404、终端认证缺失或本地 `origin/main` 缓存不能证明远程仓库不存在、已推送或 CI 已通过。

### 5. 关闭 A11

只有上述证据齐全且匹配实际验收 SHA、失败/跳过项处理完成后，才更新整改报告和开发计划，将 A11 标为 CLOSED，并生成本地文档提交。该关闭记录仍由人工通过 GitHub Desktop 推送。WebKit 结果不得表述为真实 Safari 已验收。

当前状态：**REMOTE_REVIEW / PENDING_EXTERNAL_ACCEPTANCE**。`6179d22` 已人工推送；本地已导入12张Linux候选基线，待新提交人工推送并比较。Environment 与 Ruleset 已保存；密钥未录入、规则受套餐限制不执行，A11 OPEN。最新回执见 [A11 远程检查第 6 节](../audit/F02-A11-remote-review-2026-09-20.md#6-管理员授权后的设置落地与完整基线导入)。

## A11 补齐流程（2026-09-20 历史快照，操作原理仍适用）

用户不升级 GitHub Team 的决定仍有效。管理员授权后，已创建 main-only 的 f02-signing 和8项检查的 Ruleset；此前自动审批授权不足已解除。设置保存结果不替代运行时隔离、正式验签和实际分支阻断回执。

### 正式签名与独立下载复验

`verify` 只构建并上传 `quantos-build-inputs`，不使用签名密钥。main push 后，`signing-policy` 以 `actions: read` 只读核对已存在的 `f02-signing`：custom branch policy 必须精确为 `main`，不允许 tag、通配符或其他分支；检查失败就阻止后续 job，不隐式创建环境。

`sign-main` 和 `verify-download-main` 是两个独立 runner，均只对 main push 运行并使用 `f02-signing`。前者签名并上传 `quantos-build-artifacts`，后者下载、校验完整 payload 和 HMAC，写入 `f02-download-receipt`。PR 使用无 Environment、无密钥的 `verify-download-pr`，只验证完整性。稳定 required check `verify-download` 对上游失败/跳过均拒绝，不把 skipped 当作成功。

当前执行状态及下一步：

1. 已创建 `f02-signing` Environment，Deployment branches 选择 Selected branches and tags，仅添加 **Branch: main**，不添加 tag 或通配符。
2. 管理员在该 Environment 的 Secrets 中录入随机生成的 `QUANTOS_SIGNING_KEY`（建议至少 32 字节随机值）；密钥不得发送到聊天、写入仓库或审计回执。若已有同名仓库级密钥，先由管理员核对使用方后迁移，避免 PR 可获得仓库级密钥。
3. 新的同 SHA main push 必须完整通过上述 job；下载回执中的 `formalSignatureVerified=true` 才能作为验收依据。

GitHub 官方说明：私有仓库使用 Environment、Environment secrets 和 deployment branches 需要相应付费计划；具体以当前仓库页面和实际 API 结果为准。[Environment API 与可用性](https://docs.github.com/en/rest/deployments/environments)

### Linux 三浏览器视觉基线

采集与正常比较统一固定 `ubuntu-24.04` 和仓库锁定的 Playwright。正常门禁要求 3 浏览器 × 4 页面共 **12 张 Linux PNG**，同时校验文件清单、SHA-256 和尺寸。三个视觉测试不再因缺少基线跳过；不能把 macOS PNG 改名充当 Linux 基线。

1. 人工推送本轮提交，`Visual Baseline Candidates` 自动运行；也可在后续需要时手动触发 main 的该工作流。该工作流无写仓库权限，只运行选定的 9 个视觉用例生成 12 张候选图，并上传 `linux-visual-baseline-candidates`。
2. 正常 CI 在基线未入库时会明确失败。这是预期的未完成验收状态；候选生成成功不是验收通过。
3. 从该 run 下载候选 artifact，核对 GitHub artifact digest、`receipt.json` 中完整 capture SHA、run URL、Ubuntu/Playwright 版本及 12 张 PNG 的哈希。审阅 Command、Login、Security、Browser settings 在 Chromium/Firefox/WebKit 中是否完整、无错误页/遮挡/异常状态。
4. 审阅通过后本地执行：

   ```sh
   node scripts/visual-baseline-candidates.mjs import-reviewed /absolute/path/to/extracted-candidates <完整capture-SHA>
   node scripts/check-visual-baselines.mjs --platform linux
   ```

   导入命令拒绝不完整矩阵、图片篡改及捕获后发生的渲染输入变化，更新 PNG 与清单。`import-reviewed` 只能在完成实际图像审阅后执行；命令本身不替代审阅。
5. 本地提交后再次人工推送。收集新 SHA 的三浏览器比较（Terminal 27/浏览器、Website 18/浏览器；以当前用例数及实际报告为准，视觉 skipped=0），归档 `browser-comparison-*` JSON 报告。WebKit 仍不等于真实 Safari 验收。

### 有效分支保护

[规则草案](./f02-main-ruleset.proposed.json) 已导入规则集23727075，并在UI把8项来源全部限定为GitHub Actions；保存为Active，但受套餐限制未生效。此JSON不含UI后续选择的来源ID，不是最终设置导出或生效回执。它仅匹配 `refs/heads/main`，没有 bypass，禁止删除和 force push，并要求最新基线上的 8 项 status checks：`verify`、`verify-download`、`frontend-baseline`、三项 `Web contract (...)`、两项 `acceptance (...)`。候选采集 job 不得作为 required acceptance check。

规则集已保存。未来用户决定升级且套餐具备条件后，重新读取规则页面/API，并用 PR 的失败检查验证不能合并、恢复通过后才允许合并。未执行该验证前不填写“有效分支保护 PASS”。严格 required checks 要求提交先在其他 ref 上通过检查；人工工作流应使用 GitHub Desktop 推送工作分支，再创建 PR 运行检查，不能通过为管理员添加 bypass 绕过验收。[GitHub required checks 说明](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
