# A3 当前源码本地准入：A2、R1-SERVICE 与 BFF-FE-003

本轮完成当前源码的 A2 功能回执、R1_LOCAL 聚合和 BFF003_LOCAL 准入复评。三个消费者分别绑定完整 17 / 27 / 40 节点闭包，同源共同检查只执行一次，子回执从同次完整执行派生。上游独立阶段状态不转授 READY。

## Gate 与完整执行

冻结功能源码：`31f434f75f6da9bd42b9066d9f7c909d56973e66`。第三轮从干净 Git 和全新目录完整执行 **135/135 组 PASS**；第一轮 124/134、第二轮 133/135 的原件完整保留，其 12 个失败组均在第三轮重新执行并通过，没有拼接旧 PASS。详见[执行清单](./evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-03/execution-results.json)、[失败关闭映射](./evidence/research-local-20261012/failure-closure.json)与[原子发布结果](./evidence/research-local-20261012/publication.json)。

| 消费者 | 当前 Gate | 完整闭包 | 必要检查组 | 发布检查 |
|---|---|---|---|---|
| PROVIDER:A2 | READY / A2_LOCAL | 17 节点 | 67 | 10 组 NOT_RUN |
| CORE-GATE:R1-SERVICE | READY / R1_LOCAL | 27 节点 | 85 | 19 组 NOT_RUN |
| FE:BFF-FE-003 | READY / BFF003_LOCAL | 40 节点 | 135 | 22 组 NOT_RUN |

共同检查只执行一次，子索引从同次实际执行派生。全图 **3 READY / 156 NOT_ASSESSED / 0 BLOCKED**；其余上游独立 Gate 未转授 READY。BFF-FE-003 的实现状态为 COMPLETED，PROVIDER:A3 / PROVIDER:ALL、目标数据库、发布与正式验收均未授予；`formalAccepted=false`。两计划版本为核心 3.74 / 前端 3.75。

执行命令（重验须选择全新 attempt 目录）：

```sh
node scripts/record-research-local.mjs \
  docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-03
```

| 实际命令 / 检查 | 结果 |
|---|---|
| 上述完整评估 | exit 0；135 组全部 PASS；三次隔离构建产物摘要一致 |
| `make lint` / `make test`（完整评估内部执行） | PASS；Rust 369 PASS / 7 ignored，Python 1390 PASS，web 229 PASS / 3 skipped |
| `make research-local-check` | PASS；39 项 Gate/产物负例与三个递归回执验证 |
| `node scripts/reassess-a3-prerequisites.mjs` | exit 0；三个 root 均 LOCAL_READY，上游独立状态与消费者局部证明分别列出 |
| `node scripts/provider-a2-development.mjs` / `node scripts/bff-fe-003-development.mjs --ready` | exit 0；公开入口使用当前本地回执 |
| `node scripts/provider-a2-development.mjs --target` | 按预期 exit 1，拒绝以本地回执冒充严格目标回执；没有目标执行 |
| `node scripts/check-development-plans.mjs` / `node scripts/check-frontend-gate-handoff.mjs` | PASS；3/156/0，64 任务/16 检查点，外部/性能早期 Gate 为 0 |
| `node docs/audit/evidence/research-local-20261012/research-probe-published.mjs` | 源码、执行日志、产物、依赖 manifest 四类篡改全部 REJECTED；逐字恢复后三个 Gate 再验证 READY |
| `python3 docs/audit/evidence/research-local-20261012/research-bind-source.py` | 40 节点、1431 个唯一绑定输入（1430 Git blob + 1 gitlink）与冻结提交匹配；规范范围一致 |
| Auth 修复预检：20 次 `cargo test --locked --offline -p quantos-auth --lib` | 20 轮 × 6 项 PASS；保留 Bearer 实际回环请求与 401 拒绝断言 |
| `GITLEAKS_BIN=artifacts/tools/gitleaks node --test scripts/f02-gate-negative.mjs` | 14 PASS；秘密 canary、缺扫描器及扫描失败拒绝能力保留 |
| Gitleaks 8.28.0 Git/目录/补丁扫描 | PASS，无泄漏；三个精确公开摘要例外均独立重算，比对源码/Git blob；未豁免目录、字段或规则 |
| `git diff --check` / `cargo fmt --all --check` | PASS |

主套件 7 个 Rust ignored 包括 5 个发布性能 benchmark、1 个 Supabase 目标用例和 1 个 PostgreSQL helper；未计为目标或性能通过。默认跳过的 3 个 UI bridge 已在 TP03/04/05 各自专项中实际执行，三份 ui.log 各 3 PASS / 0 skipped。完整 consumer/UI 集成仍按 I 迭代验收。

[后置命令/退出码/日志摘要](./evidence/research-local-20261012/postchecks.json)、[当前完整复评](./evidence/research-local-20261012/reassessment.json)、[篡改探针](./evidence/research-local-20261012/tamper-probes.json)、[源码绑定](./evidence/research-local-20261012/source-binding.json)可独立复核。生命周期和验收证据字段排除在功能摘要之外，新增文档/证据提交不改变上述绑定功能输入；不声称文档交付提交已有同 SHA hosted CI。

## 失败关闭与历史保护

- 第一轮十个失败组：旧 PRE01/PRE04/BFF007 契约库存、缺当前 A2 正向回执、legacy checksum 格式、Node 摘要识别、TP05 固定三场景等均已修复并在第三轮重跑。详见[首轮原件](./evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-01/failure-summary.md)。
- 第二轮 Auth WouldBlock：只修测试服务端 I/O 的阻塞模式和分段 headers 读取，没有改变生产 Auth 行为或放宽拒绝断言。Gitleaks 命中公开 OpenAPI/Auth 源码摘要，三个精确值经[独立验证程序](./evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-02/verify-public-openapi-digest.mjs)验证；真实秘密检测负例保持。详见[第二轮原件](./evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-02/failure-summary.md)。
- 原组件 canonical 产物在执行期间备份并最终恢复，冻结提交中的 **17207 个既有证据文件**无内容变化，见[历史完整性](./evidence/research-local-20261012/historical-evidence-integrity.json)。旧签署、旧失败和旧目标回执不改写，也不转授当前准入。

## 实现

- 三个独立消费者 profile、递归源码/规范/检查/日志/产物/依赖内容验证、原子发布与失败回滚。
- A2 当前 API 1.6.0 / 63 operation / 54 schema 清单和三命令正向语义回执；26 个真实回环 HTTP operation、8 个身份和 5 个 audit 语义变异。
- R1 完整本地服务闭包、R03/R04 的 Research Artifact 消费、100 个非可执行 Proposal、22 类伪造引用拒绝、零订单、Engine 生命周期清理。
- BFF-FE-003 九个 Research/Snapshot/Artifact API 的 provider 响应、生成 client/schema、权限、幂等、取消、恢复及负向验证。原 live 代码和迁移保留；本轮未应用迁移。
- PRE01/PRE04/BFF007 当前契约库存同步，历史正式回执保持原字节；TP05 要求四个明确 R04 场景并允许完整套件增长。
- Rust P95、F04 基准和 Engine P95 断言显式移交发布，阈值保留；开发真实功能执行和 deadline/取消/权限语义仍必须通过。
- BFF-FE-003 之后全部 64 任务 / 16 检查点的外部环境及性能移交持续校验，早期此类 Gate 为 0。

## 未决风险与发布责任

真实 Supabase 迁移/RLS/事务、Auth、Storage、独立 worker 的持久恢复/取消、外部 Engine 与数据来源、远程漏洞库 SCA/fork 治理、完整浏览器矩阵、同 SHA hosted CI、性能/容量/长稳均 NOT_RUN，RELEASE-GATE:BETA 接收。授权与真实用途约束保留；未使用生产凭据、未部署、未推送、未发布。

Engine 未提供完整 prompt/code 版本时返回 unreported；完整来源溯源仍需领域输出补齐。游标、读取限额和流连接容量为进程内状态，多实例及重启表现需发布验证。I 迭代 consumer/UI 的真实模块集成尚未验收，PROVIDER:A3 与正式 ACCEPTED 尚未授予，formalAccepted=false。

下一可执行任务：A3 的 BFF-FE-005（C12/C16 市场目录、watchlist、报价、K 线与图表元数据）；完成后聚合 PROVIDER:A3。本地前置按消费者限定复验，不能把 A2/R1 的上游投影当作上游独立 READY。

## 变更文件与提交

主要文件为 [聚合发布/验证器](../../scripts/research-local-gate.mjs)、[完整执行器](../../scripts/record-research-local.mjs)、[功能产物验证器](../../scripts/research-local-products.mjs)、[前置复评器](../../scripts/reassess-a3-prerequisites.mjs)、[回执策略](../../scripts/provider-a1-policy.json)、[负向测试](../../scripts/research-local-gate.test.mjs)、[性能阶段测试](../../engines/tests/test_performance_stage.py)、[本地规程](../operations/research-local-admission.md)，以及两计划、PRE01/PRE04、五个 Rust benchmark、四个 Engine contract 测试、Auth 测试 fixture、CI/Makefile 和精确摘要扫描配置。

[完整变更文件清单](./evidence/research-local-20261012/changed-files.txt)以本轮开始提交 `0076ace6` 为基线；[代码与文档清单](./evidence/research-local-20261012/changed-source-files.txt)排除原始验收证据。[证据哈希索引](./evidence/research-local-20261012/evidence-index.json)包含失败原件、成功闭包、派生索引、日志与后置验证。

已生成本地提交：`39ff40bd`（A2/R1/BFF003 完整功能准入框架）、`1089bbf7`（契约/回执与性能阶段修复，首轮证据）、`31f434f7`（Auth fixture/公开摘要精确分类，第二轮证据；第三轮冻结源码）。文档及成功证据另作本地交付提交，其 SHA 在最终交付消息报告；未 push、部署或发布。
