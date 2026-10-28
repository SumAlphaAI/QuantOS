# 360bc59 CI 修复（2026-10-28）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。基线为 `360bc59b190101fc8c679648b1a8cbc6d56c070b`，在 main 本地修复并提交。新提交 hosted CI、目标数据库、部署和发布验收为 `NOT_RUN`。

## 远端失败与原因

该 SHA 的 10 个 push 工作流已结束：7 成功、3 失败。原始运行列表、job 终态及失败日志保存在[证据目录](evidence/ci-360bc59-20261028)。

| 工作流 | 原失败 | 修复 |
|---|---|---|
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40704977956) | clean-room 模式的三个 BFF `core_l04` 测试均因 `QUANTOS_L02_FIXTURE_EXECUTABLE` 未设置而 panic；reproducibility 模式成功 | 统一测试入口先构建当前 workspace 的 execution-gateway binary，读取 Cargo JSON 中的实际 executable，再将明确的 peer 路径传给 cargo test |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40704977758) | A2 `scratch lock pruning must succeed offline`，底层原因是临时 workspace 缺少 execution-gateway/Cargo.toml | 两个 A2 变异测试入口完整复制直接依赖 execution-gateway；同时保留 X3 fixture 与编译期 SQL 输入 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40704977840) | Secret scan 报告 20 处命中 | 核实为 CORE L4 自有浏览器请求幂等键的 SHA-256 摘要，添加 20 条精确历史指纹例外 |

主 CI 的 verify-download 因上游未完成而失败，保留原拒绝逻辑。主 CI 在 Secret scan 之后的步骤和前端在 A2 之后的步骤均未由该远端运行验证，不能借用其他 SHA 的通过结果。

## 实现边界

`scripts/test-rust-with-l02.mjs` 用于 `make test-rust` 和 `make bff-provider-test`。每次先执行锁定依赖的 binary build，再使用 Cargo 输出的路径，兼容 `CARGO_TARGET_DIR` 和 F01 隔离源码目录。构建失败、信号中断、工具错误、缺少产物均阻止测试执行；测试退出状态继续向上传播。GitHub/F01 提供的 GITHUB_SHA 原样传入，本地无此值时读取当前 HEAD。不会复用调用方遗留的 fixture 路径，也未将三个测试标为 ignore 或跳过。

变异测试仍离线裁剪锁文件、验证每个包 identity/checksum 都属于原锁文件，然后使用 `--offline --locked` 执行原测试。root Cargo.lock 未修改。BFF-FE-007 具有同一缺失依赖路径，随直接相关修复一并补齐，避免前端继续运行到下一 A2 入口后再次失败；未改变业务变异、断言、测试选择或正式 Gate 阈值。

20 处扫描命中均位于 ca057dbd 和 360bc59 的 `core-l4-current-local-20261028/**/frontend-g8.json`。逐一读取相应 Git blob，核对字段为 64 位十六进制 `keyHash`、场景为 assisted-mtls-local；同版本生产者 `tests/e2e/fixtures/frontend-g8-reference.ts` 对请求 idempotency-key 使用 SHA-256。没有原始 API 凭据。例外仅绑定 commit/file/rule/line；未改 `.gitleaks.toml`、扫描命令、历史证据或通用规则，也未按目录放行。新提交的新命中继续接受检查。

## 本地验证

| 检查 | 结果 |
|---|---|
| 新入口执行 BFF `core_l04` | 3 PASS、0 ignore；覆盖真实本机子进程与回环 mTLS、重启/副本、C10、logout 及崩溃恢复 |
| 新入口拒绝测试 + 两个 A2 Gate negative + migration-ledger + F05/F07 手工策略 | 55 PASS、0 skip；其中新入口测试 7 项 |
| A2 未变异的 auth/settings 和 audit/export provider | 31 PASS；另有 live settings policy 8 PASS |
| BFF-FE-001 业务变异 | 9/9 被目标测试的实际业务断言拒绝；非编译失败 |
| BFF-FE-007 业务变异 | 8/8 被目标测试的实际业务断言拒绝；非编译失败 |
| 两个临时锁文件 | 原锁 353 包、裁剪后 331 包；identity/checksum 子集验证通过，原锁不变 |
| 原完整历史 Secret scan | 修复前 20 命中；精确例外后无命中（本机扫描 1002 commits，约 2.01 GB） |
| Secret scan 拒绝探针 | 临时 Git 历史干净输入 exit 0；同一历史证据路径的新合成 API-key 命中 exit 1，恰好 1 处；无真实凭据 |
| Node syntax、Make 调用接线 dry-run、git diff --check | PASS；dry-run 仅验证接线，不记为全仓测试执行 |

首次本机 L04 执行已正确选择 binary，但因沙箱禁止监听回环端口而失败；原日志保留。获得执行权限后使用相同入口重跑，3 项通过。该沙箱失败不记为业务测试通过。

首次本地提交后复查发现新证据清单将 check-secrets.sh 路径作为 JSON key、其源码 SHA-256 作为 value，触发 1 处摘要误报。原扫描失败保留；清单改为独立的 path / sha256 字段后修订本地提交，不增加例外、不改变摘要内容。

修复范围为测试工具接线和已核实的历史扫描误报，没有运行本机 PostgreSQL/Supabase/容器、连接真实数据库、改动迁移/权限或交易业务代码。F05/F07 完整 campaign 未运行，手工 opt-in 策略保留。没有重跑无关全仓测试、三轮 F01 构建或整条验收依赖链。

## 证据与后续

证据使用 gzip 无损归档原始日志与 JSON，`SHA256SUMS` 绑定归档文件，`source-binding.json` 绑定基线、修复文件和相关未修改输入。原远端失败、本机沙箱失败与修复后通过结果分别保存；不改绑历史验收状态。

本轮只生成本地 Git 提交，不推送。用户推送后需检查新同 SHA 的三个工作流及后续步骤；本地 scoped PASS 不代表 hosted CI、完整 F01、真实目标环境或发布验收通过。
