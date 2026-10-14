# TP01-F canary、观测与回滚：本地开发准入 — 2026-10-14

TP01-E 最新复验与实现待验收状态已先由 `ee34aed0` 同步开发计划。本轮完成 TP01-F 本地实现，冻结候选 `5e5558021f1dffabbcbf246d2b1fce629b15377e` 从干净提交完整执行 **29节点/92组** 必要本地检查，全部PASS。没有复用旧SHA执行来冒称本轮复验。实际结果见[完整执行](./evidence/provider-a1-remediation-20261004/tp01-f-local-20261014/attempt-02/execution-results.json)、[完整闭包](./evidence/provider-a1-remediation-20261004/tp01-f-local-20261014/attempt-02/local-prerequisites.json)与[独立核验](./evidence/tp01-f-local-20261014/verification.json)。

## Gate 与执行状态

F为TP01-F_LOCAL限定DEVELOPMENT READY，E从同一轮实际执行派生28节点/88组新证明并恢复限定READY；全图2 READY / 157 NOT_ASSESSED / 0 BLOCKED。没有授予其他上游独立READY、R1-SERVICE或SERVICE:TP01。两项开发状态均IMPLEMENTED_PENDING_ACCEPTANCE，formalAccepted=false；F的targetCanaryAccepted=false、targetRollbackAccepted=false，E的syncApproved=false。

[E新manifest](./evidence/tp01-e-readmission-20261014/manifest.json)与[F manifest](./evidence/tp01-f-local-20261014/manifest.json)绑定同一冻结提交；E子集的每个命令、时间、退出码、log/artifact/supporting hash均与本轮F实际记录一致。E原9b7bb8e5原件保持历史字节，未覆盖原manifest或篡改既有失败。生产、数据库、实际发布/CI及真实窗口的验收均未执行。

## 实现与变更文件

- 新增[rollout.py](../../engines/vibe-adapter/src/vibe_adapter/rollout.py)及[独立演练](../../engines/vibe-adapter/src/vibe_adapter/local_drill.py)：宿主提供authority/policy，对实际candidate/previous catalog字节、release ID及policy digest作HMAC-SHA256验签，固定QuantOS原生协议provider；默认禁用、5%稳定分流、影子制品隔离、阈值告警、事件审计、epoch撤销和动作/提交共锁。
- 更新service/server/fixtures及README；默认拒绝Execute/StreamExecute，保留health/metadata；只允许TEST/RESEARCH。原unsigned合成回归显式使用fixture_mode/--fixture-routing，不能用于发布。更新Python契约/skeleton测试和Rust EngineManager的Vibe启动参数。
- 新增[47项Python回归](../../engines/tests/test_vibe_adapter_rollout.py)。实际unary/stream在动作先发生时返回CANCELLED/ENGINE_ROLLOUT_REVOKED，不再写Artifact；提交先完成时结果有效，stream可确定性完成。再次激活不能恢复旧epoch，rollback实际切回事先验签的previous provider，同一idempotency key不能静默改绑不同制品。
- 更新策略模拟与rollback脚本/15项回归：拒绝坏类型、NaN、缺测，缺影子证据阻断，disabled/rolled_back候选流量为0；动作保留事故/阻断。输出显式SYNTHETIC_POLICY_SIMULATION，不将7天/240秒fixture当作目标验收。
- 新增功能回执生产者/37项复制原件负向、29节点Gate/57项准入与计划负向、完整冻结运行器、同候选E派生和E/F成对回滚；登记policy/两计划/发布移交契约及Makefile入口。E新manifest使用独立readmission目录以保留原件。
- 更新dashboard/alert配置、[rollback runbook](../runbooks/tp01_vibe_adapter_rollback.md)与[本地准入规程](../operations/tp01-f-local-admission.md)。snapshot明确字段映射，runtimeMetricExport=false；未部署目标监控。
- AST导入边界修复只允许rollout.py的hmac/math与local_drill.py的hmac/concurrent/uuid；同一原测试内补入网络、子进程、上游运行时、相对及动态导入拒绝探针，原44项数量不变。没有跳过失败测试。`.gitattributes`只保留本次F捕获的generated/original/supporting Markdown EOF原始字节，源码和手写文档保持原检查。

全部变更路径和原件hash见[变更清单](./evidence/tp01-f-local-20261014/changed-files.txt)与[证据封存](./evidence/tp01-f-local-20261014/seal.json)。源码提交与证据提交分离；收尾仅更新结果展示和证据，不改变本轮规范输入。

## 完整冻结测试

| 命令/检查 | 本轮结果 |
| --- | --- |
| `node scripts/record-tp01-f-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-f-local-20261014/attempt-02` | 29节点/92组实际执行PASS；三次独立跨语言构建PASS |
| `make test`（f01-test） | Rust396 PASS/8 ignored；Python1437 PASS；Web233 PASS/3 skipped；0失败 |
| `node scripts/tp01-f-functional.mjs --record` | 47项Python、19条独立本机UDS演练、15项模拟回归和三组CLI PASS；功能回执不自行授予Gate |
| `node --test --test-reporter=tap scripts/tp01-f-functional.test.mjs` | 37/37 PASS；复制原件缺失、签名/制品/事件篡改及虚假目标声明拒绝 |
| `node --test --test-reporter=tap scripts/tp01-f-local-gate.test.mjs scripts/tp01-f-plan-contract.test.mjs` | 57/57 PASS；缺前置、目标义务删改、错误候选及写入失败回滚 |
| E功能回执/准入专用检查 | 55/55 + 49/49 PASS，原23项同步回归及12个CLI场景实际执行 |
| `node scripts/check-tp01-f-style.mjs` | Ruff check/format、Pyright PASS |
| `node docs/audit/evidence/tp01-f-local-20261014/verify.mjs --record` | 冻结输入、同源E子集、旧原件、canonical恢复与Gate范围独立核验PASS |

ignored/skipped均单独保留，不计PASS；数据库目标结果不能由本地替代。功能回执、实际演练和原始运行记录保存于attempt的artifacts/supporting，不依赖已恢复为旧版本的canonical目录。[进程结果](./evidence/tp01-f-local-20261014/assessment-02-status.json)实际退出0。

独立核验确认1396项冻结输入（1395个文件、1个Gitlink）；34865份冻结源已有历史证据字节不变，626份canonical恢复为原件。

## 失败原件与整改

| 轮次/冻结源 | 实际结果 | 处置 |
| --- | --- | --- |
| 开发初测 | 27 PASS/8 FAIL/144 ERROR | 沙箱拒绝UDS绑定；允许仅本机UDS、去除凭据后的复验通过；摘要明确不冒称保存完整raw stdout |
| attempt-01 / 4f44ca5f | 79 PASS/13 FAIL；make test为Rust396 PASS/8 ignored、Python1436 PASS/1 FAIL、Web NOT_RUN | 原AST许可缺新增标准库，引起共享全量Python/证据负向拒绝；626 canonical恢复，无index，无Gate |
| 非冻结修复预检 | Python1437 PASS | 按文件范围限定标准库并补拒绝探针；不替代冻结复验 |
| attempt-02 / 5e555802 | 92 PASS；完整29节点准入与成对发布PASS | 全新干净候选完整执行，不拼接首轮通过记录 |

[首轮执行](./evidence/provider-a1-remediation-20261004/tp01-f-local-20261014/attempt-01/execution-results.json)、[首轮失败](./evidence/provider-a1-remediation-20261004/tp01-f-local-20261014/attempt-01/failure.json)、[首轮处置](./evidence/tp01-f-local-20261014/attempt-01-disposition.json)、[沙箱失败摘要](./evidence/tp01-f-local-20261014/development-01/sandbox-failure.json)及[原件空行检查](./evidence/tp01-f-local-20261014/raw-whitespace-check-01.log)全部保留。早期Pyright类型、复制测试profile和Beta prose/JSON对齐失败在开发中修正；未改记为历史PASS。

## 未决风险与发布移交

22组共享Supabase/外部/性能检查及F新增6项目标义务均NOT_RUN：真实连续7天无未解释P1、获准目标环境回滚≤300秒、可信发布制品与drill签名、持久audit/跨进程恢复和业务控制授权、目标监控导出/真实影子消费、候选同SHA hosted CI。完整清单在F manifest的release.prerequisiteChecks和release.functionalTargets，以及两计划RELEASE-GATE:BETA中。

本机回滚对象为研究catalog/provider，尚未验收wheel/容器/部署二进制回滚；公开fixture authority不构成生产签名信任。controller、mock Artifact、审计均在本机进程内；目标部署、持久恢复与正式控制面须独立实现/验证。未使用生产凭据，未连接数据库，未派发远程workflow、issue/PR、push或部署，未批准上游候选采用。

下一可执行任务为TP01-G的本地原生协议隔离/模块替换回归与替换计划；上游贡献只形成可审阅patch/说明，外部提交需另行授权。SERVICE:TP01全量服务准入仍须独立完整评估。

## 最终收尾检查

[收尾回执](./evidence/tp01-f-local-20261014/post-checks.json)：10/10检查满足预期。真实完整index的1正向/23负向共24/24 PASS；计划负向44/44 PASS；E/F READY均退出0，E/F RELEASE均预期退出2；计划、核心/前端交接与最终独立核验PASS。

首次状态同步将日期放入“当前工程复核”字段名，计划解析器要求固定前缀而拒绝；[初次收尾结果](./evidence/tp01-f-local-20261014/post-attempt-01/post-checks.json)及原日志全部保留。恢复固定字段名后重跑10项收尾检查通过。这是展示格式修正，未改变源码、规范要求、冻结输入或已完成的92组执行；最终核验仍逐项比对冻结源。
