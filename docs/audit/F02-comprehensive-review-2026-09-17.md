# F02 CI、制品与供应链门禁全面复审报告

> 本文保留初次审计快照；整改后的状态与复验见 [F02 整改记录](./F02-remediation-2026-09-17.md)，下文 OPEN 和完成率均为原审计时点。

> 日期：2026-09-17；依据：[开发计划 v3.6](../SumAlpha-QuantOS-Development-Plan.md) F02、§2.2、§2.3、§2.4。
> 审计源码：`daf81d2f057c6b0c2d8c368f0c2b3930de91c704`；开始时工作区干净。
> 结论：**CHANGES_REQUESTED**，实际交付为 **PARTIAL**，不满足 F02 完整验收。本轮只新增审计材料，不修复实现、不修改开发计划状态、不生成提交。

## 一、任务完成概况

PR/main 工作流、三语言质量入口、SBOM、NOTICE 模板、签名及数据库检查脚本均已存在，但多项安全门禁会错误接受不合格输入，主干运行时制品也未形成完整的构建、打包、哈希绑定和签名交付链。

**严格检查点完成率：37.5%（9/24）**。按需求、交付物、最低开发规范和验收要求拆成 24 个等权检查点：PASS 9、PARTIAL 6、FAIL 8、NO RECEIPT 1。仅 PASS 计入分子，部分完成不折算；缺少回执不推定远程执行失败。该比例是 F02 检查点完成率，不是代码量、工时或 F0 完成率。

**三项量化验收完整通过率：0/3。** 原生自检显示通过不能替代针对真实入口的负向验证。本次已复现 secret 漏检、RLS 漏检、schema drift 检查范围不足、主干 proto 自比较和制品绑定缺失。

| 优先级 | 数量 | 状态 |
|---|---:|---|
| 阻塞级 | 0 | 未发现需要判为无法继续开发或已发生严重事故的证据 |
| 高危 | 6 | 全部 OPEN；安全门禁或关键交付链不满足要求 |
| 中危 | 6 | 全部 OPEN；覆盖、规范或验收证据缺口 |
| 低危 | 0 | 未独立列入纯提示性优化 |
| 合计 | 12 | 必须完成整改和复验后再接受 F02 |

审计未使用生产凭据，未连接真实数据库，未发布或下载远程项目制品。GitHub CI 当前运行、分支保护 required checks、远程制品签名及浏览器矩阵未取得可复核回执，保留 `NOT RUN / NO RECEIPT`。

## 二、完成情况明细统计

### 2.1 逐项核对

| 编号 | 检查点 | 状态 | 核对结果与证据 |
|---|---|---|---|
| C01 | PR/main CI workflow | PASS | `ci.yml`、`frontend-baseline.yml`、`compatibility.yml` 均接入 PR/main；这是仓库配置交付，不代表远程运行已通过 |
| C02 | fmt/lint/typecheck | PASS | CI → Make 覆盖 fmt、Clippy、Ruff、Pyright、TS lint/typecheck；实现与 F01 完整通过源码相同 |
| C03 | 三语言 unit 测试入口 | PASS | `make test` 接入三语言；复用相同实现的 Rust 186 passed/1 ignored、Python 91、一期 TS 115 项证据 |
| C04 | contract 测试 | PASS | BFF/Engine 契约入口存在；frontend CI 调用 `vitest run tests/contract`，本次 13/13 通过 |
| C05 | 覆盖率最低规范 | PARTIAL | Rust/Python/TS 阈值及 CI 调用存在；当前 SHA 无完整覆盖率回执，不能仅凭单元测试计为达标 |
| C06 | Web 兼容性 | PARTIAL | Chromium/Firefox/WebKit 工作流存在；本次未取得当前 SHA 的三浏览器执行证据，不把 WebKit 配置声称为真实 Safari 已验收 |
| C07 | proto 破坏检测与兼容基线 | FAIL | 语法破坏可拒绝，但 `breaking --against .git#branch=main` 在 main push 自比较，字段删除被接受；A08 |
| C08 | 冻结依赖及 manifest 漂移 | PASS | 本次 `make lockfile-check f01-check` 通过，16 项负向测试包含三语言 manifest 漂移与无效锁拒绝 |
| C09 | secret scan | FAIL | Gitleaks 配置未加载规则；合成 Slack token 被 CI 配置及 Node 补充扫描器同时接受；A01 |
| C10 | 三生态 SBOM 生成 | PASS | 实际生成 SPDX 2.3 JSON，包含 Cargo 347、npm 755、PyPI 28 个锁定包及根包；不将生成等同许可证审查或制品绑定 |
| C11 | license gate | FAIL | Node 扫描只列 22 个包，遗漏已安装的应用 Next.js；Python 无 license 入口；A07 |
| C12 | 三生态 SCA 检查 | PARTIAL | Cargo/uv/pnpm 入口存在，Node 和 Python 本次执行；固定版本 Rust 扫描未运行，构建/开发依赖覆盖不完整；A12 |
| C13 | 带到期日豁免 | PARTIAL | 必填/到期校验有效，但 waivers 未接入扫描结果裁决；A09 |
| C14 | 高危漏洞为零或有效豁免 | FAIL | Node 生产依赖当前扫描 2 critical、1 high；waivers 为空；A06 |
| C15 | NOTICE 模板 | PASS | `THIRD_PARTY_NOTICES.md` 含流程、登记模板和已有条目；不据此宣称所有传递依赖义务已审查 |
| C16 | 签名脚本基本能力 | PASS | 本地固定假密钥 HMAC-SHA256 正向签验通过，签过的 metadata 篡改后被拒绝；这是脚本原语验证 |
| C17 | 可追溯 build manifest | PARTIAL | 有 commit、三种依赖锁 digest、工具版本；没有运行时产物清单/digest 或 SBOM digest；A05 |
| C18 | 主干实际制品交付及签名绑定 | FAIL | CI 未打包全部运行时产物，仅上传 `artifacts/`；Make 签名只含 manifest/SBOM；A05 |
| C19 | migration 文件基线检查 | PASS | 文件命名、非空等入口本次通过；不将其当作 SQL 执行或完整 schema 验证 |
| C20 | CI 本地重建/迁移重放 | PARTIAL | 有连接数据库后隔离 schema 回放脚本，但 CI 无必跑临时数据库，缺 URL 时跳过；A03 |
| C21 | schema drift | FAIL | 只核对 ledger 文件名，不检查 SQL 内容校验和和真实结构；同名已变更 SQL 被接受；A04 |
| C22 | RLS policy 与权限负向检查 | FAIL | 静态检查把索引 `on table` 当 policy，且忽略后续 disable；live 检查可跳过，且 catalog 检查不替代跨租户身份查询；A02/A03 |
| C23 | 五类故意破坏均使真实 CI 失败 | FAIL | 部分破坏被误接受；self-test 仅看非零退出码，工具故障也报成功；A01/A02/A04/A08/A10 |
| C24 | 当前 SHA 的远程 CI/主干制品验收回执 | NO RECEIPT | 无当前 SHA 的远程运行、制品下载复验及 required-checks 证据；A11 |

统计：PASS=9、PARTIAL=6、FAIL=8、NO RECEIPT=1，总计 24。同一根因可影响多个不同验收要求，但问题 ID 不重复计数。C16 只计脚本自身行为，不能抵消 C17/C18 的端到端缺口。

### 2.2 三项量化验收

| 原要求 | 判定 | 原因 |
|---|---|---|
| 任一注入 secret、破坏 proto、未锁定依赖、RLS 缺失或 schema drift 均使 CI 失败 | FAIL | 锁漂移拒绝有效；其余存在漏检或不能证明真实入口正确拒绝，不满足“任一”条件 |
| 主干制品含 commit、依赖 digest、SBOM | FAIL | metadata 可生成，但缺完整运行时制品包及内容绑定；无远程主干交付回执 |
| 高危漏洞=0 或有带到期日的豁免 | FAIL | 当前 runtime Node 扫描非零，豁免为空；全生态证据亦不完整 |

### 2.3 实际检查和证据层级

证据总入口：[summary.json](./evidence/F02-2026-09-17/summary.json)，含命令退出码与文件 SHA-256。

| 检查 | 实际结果 | 证据 |
|---|---|---|
| 自带 deliberate-break 测试 | 退出 0；6 个断言报告通过，但不充分 | [日志](./evidence/F02-2026-09-17/self-test.log) |
| migration、RLS 静态基线、waiver | 退出 0；0 个豁免 | [日志](./evidence/F02-2026-09-17/static-checks.log) |
| 当前锁文件与负向门禁 | 退出 0；16/16 | [日志](./evidence/F02-2026-09-17/lock-gates.log) |
| 根 contract 测试 | 退出 0；13/13 | [日志](./evidence/F02-2026-09-17/contracts.log) |
| Node 许可证入口 | 退出 0，但仅 22 个包 | [清单](./evidence/F02-2026-09-17/node-license-inventory.json)、[日志](./evidence/F02-2026-09-17/node-license.log) |
| Node 生产依赖 SCA | 退出 1；2 critical、1 high，162 个依赖 | [原始 JSON](./evidence/F02-2026-09-17/node-audit.json) |
| Python runtime SCA | 隔离源码副本执行原脚本，退出 0，未发现已知漏洞 | [日志](./evidence/F02-2026-09-17/python-audit.log)；仅代表该次该范围查询 |
| Rust SCA/license | NOT RUN | 本机 cargo-deny 0.18.4 与 CI 固定 0.20.2 不同，没有把其他版本结果冒充正式验收 |
| SBOM / manifest 生成 | 两命令退出 0 | [SBOM](./evidence/F02-2026-09-17/sbom.json)、[manifest](./evidence/F02-2026-09-17/manifest.json) |
| RLS/schema/签名独立负向探针 | 复现 4 个误接受场景；metadata 篡改拒绝正常 | [探针](./evidence/F02-2026-09-17/probes.py)、[结果](./evidence/F02-2026-09-17/probes.json) |
| Gitleaks 8.28.0 正反对照 | 官方 release 校验和通过；默认规则拒绝，项目配置接受 | [探针](./evidence/F02-2026-09-17/gitleaks-probe.py)、[结果](./evidence/F02-2026-09-17/gitleaks-probe.json) |
| Buf 基线负向对照 | main 自比较退出 0；对比上一提交退出 100 | [探针](./evidence/F02-2026-09-17/proto-probe.py)、[结果](./evidence/F02-2026-09-17/proto-probe.json) |
| 自检工具故障探针 | Buf 固定退出 42，自检仍退出 0 | [探针](./evidence/F02-2026-09-17/self-test-probe.py)、[结果](./evidence/F02-2026-09-17/self-test-probe.json) |
| 豁免日期正反对照 | 有效日期通过，过期日期拒绝 | [结果](./evidence/F02-2026-09-17/waiver-probe.json) |

fmt/lint/unit 复用 [F01 完整运行日志](./evidence/F01-remediation-2026-09-17/clean-room.log)：已核实当前提交相对 `6059310` 只有文档变更，见 [基线核对](./evidence/F02-2026-09-17/baseline.json)。本次没有重复声称整套 CI 已执行。所有数据库探针为 SOURCE/MOCK，不提供真实 Supabase 执行证明。

## 三、问题清单及风险分析

分级：阻塞级指无法继续开发或已确认严重边界破坏；高危指关键安全门禁误放行或核心验收不成立；中危指检查覆盖、可追溯性或验证完整性不足；低危指不影响执行的局部文档问题。以下均为 OPEN。

| ID / 优先级 | 所属模块 | 具体表现与定位 | 影响范围及风险 |
|---|---|---|---|
| F02-A01 / 高危 | secret scan | `.gitleaks.toml:1–16` 只有 allowlists，没有规则或 `extend.useDefault`；`ci.yml:82–88` 使用该配置。固定 8.28.0 实测：合成 Slack token 的项目配置退出 0、默认配置退出 1；Node 四类正则也退出 0 | 可漏过不属于 Node 四类模式的秘密；当前自检只注入 GitHub token，不能证明实际 Gitleaks 有效。未发现或声称实际秘密已泄漏 |
| F02-A02 / 高危 | RLS 静态门禁 | `check-rls-baseline.sh:53–65` 按全文匹配 enable/force，policy 仅匹配 `on table`；删 policy 留索引、末尾 append disable 两个探针均退出 0 | 无 policy 或最终未启用 RLS 的迁移可过静态 Gate；缺 URL 时无 live 检查兜底。不是对现有线上 RLS 状态的判断 |
| F02-A03 / 高危 | CI 数据库接线 | `ci.yml:140–151` 将 drift/replay/live-RLS 全部放在 `DATABASE_URL != ''` 条件下；没有独立临时 PostgreSQL/Supabase 初始化服务 | 缺秘密的 PR 或空配置路径跳过必需检查；不满足 §2.4 的 CI 本地重建、RLS/权限负向验证要求。现有 live catalog 查询亦不等价身份隔离测试 |
| F02-A04 / 高危 | schema drift | `db-cli.cjs:136–161` 只查 ledger 文件名，ledger 无 SQL checksum，也不对比表/列/索引/policy；对同名已改 SQL、RLS 已关的模拟状态仍报告匹配 | 已应用 migration 被改写、带外 DDL/policy 漂移均不在检测范围；“schema-diff”名称和实际保证不一致 |
| F02-A05 / 高危 | 主干制品、manifest、签名 | `ci.yml` 没有完整 release/wheel/Web 打包步骤，只上传 `artifacts/`；Terminal 已构建的 `out/` 也不在该上传路径。`Makefile:196–200` 仅签 manifest/SBOM；manifest 无运行时文件和 SBOM digest | metadata 正确签验仍无法验证可交付应用内容；运行时 payload 改动后原验证仍通过。HMAC 对已签文件的拒绝有效，问题在制品范围和绑定，不将 HMAC 本身武断认定为违反规范 |
| F02-A06 / 高危 | 漏洞准入 | 当前 `pnpm audit --prod --audit-level=high` 退出 1，2 critical、1 high；`security/sca-waivers.json` 为空 | 明确不满足“高危=0或豁免”；扫描器正确拒绝，不能把此项归为扫描器误放行。部署可利用性须另评估 |
| F02-A07 / 中危 | license gate | `check-node-licenses.mjs:12–27` 从根调用 license-checker，实际只得到 22 项，未枚举已安装的应用 Next.js；Make license-check 仅 Rust/Node，没有 Python license 核查 | 应用和 Python 依赖许可证可能未经门禁判定；根扫描绿灯不能当作 Polyglot 全覆盖 |
| F02-A08 / 中危 | proto breaking baseline | `check-proto.sh:59` 固定 `.git#branch=main`；main push 的比较基线即当前提交。删字段探针：main 对自身通过，HEAD~1 正确拒绝 | 合并后的破坏性协议变更可漏检。PR detached checkout 的基线存在性也未显式建立，但本报告不把该推断写成已确认远程故障 |
| F02-A09 / 中危 | SCA waiver | `check-sca-waivers.mjs` 仅校验字段和到期；`Makefile` 的三个 SCA 执行器均不读取这份例外清单，cargo deny 的 ignore 另为空 | 即使登记合法临时豁免，原 scanner 仍直接失败；无法实现统一、带到期约束的告警裁决和追踪 |
| F02-A10 / 中危 | 门禁自检可信度 | `test-quality-gates.mjs:26–30` 只判非零退出；无正向控制/错误原因约束。把 Buf 替换为始终退出 42 的不可用工具后仍“全部通过”；secret 自检与 CI 扫描器不同，schema 自检仅比较数组 | 工具缺失、配置错误或错误路径能冒充预期拒绝，自检不能作为五类 CI 失败条件的充分证据 |
| F02-A11 / 中危 | 验收回执/远程执行 | 当前 SHA 未取得全套 CI、覆盖率、兼容矩阵、数据库检查、主干签名制品下载复验回执；本机亦未运行固定版本 Rust SCA/license | F02 无法获得完整放行结论；这是证据缺口，不是已确认 GitHub 故障或高危 Rust 漏洞 |
| F02-A12 / 中危 | SCA 扫描范围 | Node 固定 `--prod`，Python export 固定 `--no-dev`；未见另行审计开发/构建依赖的步骤或经批准的范围例外 | Ruff、Pyright、测试/构建工具等供应链不在该扫描范围；运行时绿灯不能证明计划所称依赖高危为零。未推定被排除依赖实际存在漏洞 |

当前 Node 告警为 `next` 的 [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)、[GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)，以及 `sharp` 的 [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)。其中告警涉及 Windows 服务或图像处理等条件；当前静态导出不自动证明可被利用，也不能代替到期豁免流程。这里保留包注册表当次结果，不宣称已确认生产 RCE。

Gitleaks 自定义配置不会自动继承默认规则，应显式扩展或定义规则；此语义与本次固定版本对照一致，参见 [官方配置说明](https://github.com/gitleaks/gitleaks#configuration)。本报告没有扫描真实秘密；探针使用一次性合成字符串。

风险关联：A01/A02/A04/A08 是误放行路径；A03 放大数据库静态漏检风险；A05 使签验成功不能证明应用内容；A10 使原“全绿自检”掩盖前述缺口。A06 是当前阻止验收的依赖告警，A11 为证据不足，二者不能混为一类。

## 四、整改建议

| 顺序 / 建议责任角色 | 问题 | 整改动作 | 关闭验收条件 |
|---|---|---|---|
| 1 / 安全与 CI 维护者 | A01、A10 | 为 Gitleaks 加载有效默认/自定义规则；用同一 CI 扫描器测试多种合成秘密；所有负向检查先证明正向基线成功，再验证预期诊断，工具故障单独失败 | Slack/GitHub 等注入均被实际 CI 入口拒绝；正常源码通过；Buf 不可用不能显示自检全绿 |
| 2 / 数据库与 CI 维护者 | A02、A03、A04 | PR 必跑隔离数据库重建；核对最终 catalog 和迁移内容 checksum；比较标准 schema 与目标结构；增加不同 actor/tenant/role 的实际权限负向查询 | 缺 policy、disable/no-force、宽松 policy、带外列/索引变化、已应用 SQL 改写均失败；缺必要检查环境不得把任务标为 PASS |
| 3 / 构建与发布维护者 | A05 | 明确 F02 交付包，实际构建/打包 Rust、Python、Web；manifest 列产物/SBOM/锁/源码 digest，签名绑定完整包；下载后验签并验证双向清单 | 任何 payload 修改、删除、替换或混入旧 SHA 产物都拒绝；主干真实制品具备可复核 commit、依赖 digest、SBOM |
| 4 / 依赖与安全维护者 | A06、A07、A09、A12 | 升级告警依赖或经授权登记有边界和到期日的豁免；统一消费三生态扫描结果；按 workspace 枚举 license；补 Python 和开发/构建依赖扫描 | 全量清单与锁/安装图对齐；未知/禁止许可证被拒绝；有效豁免仅命中指定告警，过期自动阻断；其余 high/critical 为零 |
| 5 / 协议维护者 | A08 | PR 显式 fetch/固定目标基线；main push 对比前一受信提交或发布基线，禁止基线退化为当前 HEAD | 删除已发布字段时 PR/main 均失败；正常兼容变化通过；基线缺失明确失败 |
| 6 / 验收责任人 | A11、全部问题 | 在修复提交运行完整 PR/main 管道并归档 exact-SHA 回执、覆盖率、浏览器/DB结果及下载制品验签记录 | 同一实现 SHA 下全部要求通过、问题 CLOSED 后再把 F02 改为 ACCEPTED；F0 Gate 独立评估 |

复验入口应包括 `make lockfile-check proto-check db-migration-check quality-gate-self-test lint test license-check waiver-check sca-check`，以及修复后的隔离 DB 和完整制品构建/签验任务。不要直接把当前原生自检全绿当作整改完成。

### 4.1 证据重放说明

从仓库根目录、固定 Node 24.12.0/pnpm 10.20.0/uv 0.7.0 工具环境执行证据目录内四个 `*-probe.py`/`probes.py`。`gitleaks-probe.py` 需要官方 Gitleaks 8.28.0，使用 `GITLEAKS_BIN` 指定经官方校验和验证的二进制；本轮下载记录见摘要与 `gitleaks-checksums.txt`。各探针均使用临时目录并自行清理，不连接目标数据库，不改真实签名产物。

SOURCE/MOCK 结果只证明被测入口的行为，不模拟生产验收。后续运行应生成独立新证据，保留本次历史记录。网络首次下载 Gitleaks 曾超时，续传并校验成功后才执行对照；Python 扫描出现本机 LibreSSL 警告但最终退出 0，二者均未伪装为产品失败。
