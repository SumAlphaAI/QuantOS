# TP02_LOCAL 本地准入与完整必要闭包（2026-10-13）

结果：**TP02_LOCAL DEVELOPMENT READY**。第二轮冻结提交 `135c7bd52e0f3a8c2d59abb50b3081d6e8843b1e` 从干净工作区完整执行13节点/44组本地复验，全部PASS并实际发布。全图1 READY / 158 NOT_ASSESSED / 0 BLOCKED，仅CORE:TP02 READY。首次发布失败和回滚原件保留，未拼接第一轮结果。目标、外部环境和性能均NOT_RUN，formalAccepted=false。

## 实现范围

新增 `scripts/tp02-local-gate.mjs`、`scripts/record-tp02-local.mjs`、专用负向测试及 Make 入口，登记公共本地策略与两份计划的阶段合约。唯一消费者CORE:TP02，直接依赖F08/F0；必要闭包按依赖后序为F01、F03、F04、F05、F06、F07、F08、F02、F09、TP01-A、TP01-B、F0、TP02，共13节点。[操作规程](../operations/tp02-local-admission.md)保留准入与发布边界。

44组本地检查包含新增TP02专用负向组；相对2026-10-12预检映射，远程SCA查询移交1组，因此本地数量仍44。13组目标/远程命令保留原命令、NOT_RUN并归测试/RELEASE-GATE:BETA。单消费者准入仅授予TP02 DEVELOPMENT READY；上游12节点为owner=CORE:TP02的LOCAL_READY投影，不授予R1-SERVICE或其他消费者。

验证器校验完整同候选索引、13节点依赖、源码/规范、真实命令/日志/支撑制品摘要、异常执行和用途边界；缺闭包、候选混用、日志/wheel替换、生产/数据库/正式越权均拒绝。发布先验证完整wrapper，再写manifest与计划；写入或后验失败恢复原字节，首次失败移除新manifest。记录器成功或失败均保存生成输出并恢复canonical原字节，发布异常也持久记录。

本地研究仍为QuantOS自有fixture provider：hypothesis/experiment两capability，两组固定fixture各Execute两次、StreamExecute两次（至少8次具名回放，另有五RPC harness），稳定hash/Artifact读回及tenant/owner隔离、幂等、取消/deadline/transport拒绝。实际安装SDK/RD-Agent wheel到隔离venv，Python -I从site-packages启动独立UDS子进程、五RPC并回收。Runtime测试使用合成catalog/record，无已退役32条事实消费或新采集。snapshotBytesResolved=false、toolsExecuted=false；不证明真实snapshot字节、工具、LLM或Microsoft RD-Agent上游运行时。

## 冻结与失败保留

初始冻结 `5e163d62882961ea3af027385da3bb299e61d98b` 完整执行44/44组功能检查PASS，生成13节点LOCAL_READY索引，但计划顺序校验器未登记TP02_LOCAL的阶段例外，发布拒绝“READY requires READY prerequisite CORE:F08”。发布事务回滚，保持0 READY，canonical 39份原件恢复并核对。首次[发布失败回执](./evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-01/publication-failure.json)、[完整功能台账](./evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-01/execution-results.json)和[原始错误](./evidence/tp02-local-20261013/implementation-failures/03-publication-unregistered-plan-scope.log)均原字节保留。

修复两份计划与机器阶段合约登记，并补齐真实计划解析的正负向：TP02-only READY与上游NOT_ASSESSED通过，错profile/消费者、缺F08、严格READY别名、数据库/正式越权和release PASS拒绝。55项专用测试、149项共享测试及42项计划负向通过。修复与首次失败证据冻结为 `135c7bd5`，第二轮从干净工作区完整重跑，禁止拼接第一次结果。

实现期间两次文档同步失败也保留：正文/JSON checkpoint scope漂移，以及前端handoff机器清单未同步；修复后校验通过，见[实现失败目录](./evidence/tp02-local-20261013/implementation-failures)。所有历史TP02 Python回执计数/安装失败、F0 HTTP500/只读/F09超时、D预检/链接失败及旧Gate仍保留。

本轮修改公共输入后撤回上轮A2/R1-SERVICE/BFF003/BFF005/A3五个READY，保存[原阶段快照](./evidence/tp02-local-20261013/prior-stages.json)。历史候选1ee328c7的42节点/140组结果不转移到本轮；当前任务只复验TP02必要闭包。

## 命令与结果

执行器剥离数据库/Supabase/凭据/目标opt-in，使用QUANTOS_SKIP_ENV=1、UV_OFFLINE=1、CARGO_NET_OFFLINE=true、npm_config_offline=true、QUANTOS_RELEASE_PERFORMANCE=0和固定pnpm 10.20.0。

```sh
node scripts/record-tp02-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-02
make tp02-local-check
node docs/audit/evidence/tp02-local-20261013/run-final.mjs final-01
python3 docs/audit/evidence/tp02-local-20261013/seal-evidence.py --verify
```

第二轮[完整执行台账](./evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-02/execution-results.json)、[13节点索引](./evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-02/local-prerequisites.json)、[限定Gate](./evidence/tp02-local-20261013/manifest.json)均绑定新冻结完整SHA。最终[收尾台账](./evidence/tp02-local-20261013/final-01/results.json)包含实际证据破坏探针及发布拒绝。

| 实际命令/检查 | 结果 |
| --- | --- |
| F01三次 make bootstrap / cargo build --workspace --release --locked / pnpm build / make build-python | PASS，三次独立制品摘要一致，source.dirty=false |
| make lint / make test | PASS；完整Rust/Python/前端套件，Python1390；domain-ui另有3项既有skipped，不计作通过 |
| Proto/client生成、foundation/event/storage/auth、F04/F05行/分支覆盖及负向 | 全部PASS |
| F07 Runtime/Gateway本地、F08功能/branch/安装服务、F09本地及TP01本地baseline/capability/intake | 全部PASS |
| pytest test_rd_agent_contract.py test_rd_agent_development.py -vv | 131 PASS，两组双RPC确定性回放及Artifact/身份/取消拒绝 |
| pytest engines/tests -q | 完整1390 PASS、0 skipped；多次全目录运行不累计为独立用例数 |
| cargo test --locked --offline -p quantos-engine-manager --test python_rd_agent | 2/2 PASS |
| cargo test --locked --offline -p quantos-runtime --test research_orchestration research_workflow_ -- --nocapture | 2/2 PASS，实际Python子进程不能导入vibe_adapter |
| python scripts/tp02-packaged-service.py | PASS，2份wheel离线安装新venv、site-packages、5 RPC/2 capability及子进程回收；TP02十组组件全通过 |
| node --test scripts/tp02-functional-artifacts.test.mjs | 26/26 PASS，完整Python计数增长与不完整总结拒绝 |
| node --test scripts/tp02-local-gate.test.mjs | 55/55 PASS，含真实计划解析、发布回滚与越权拒绝 |
| 共享Gate/receipt负向、计划负向 | 149/149及42/42 PASS |
| 实际证据破坏探针 | 26/26 PASS；候选/闭包/命令/异常执行、原日志与wheel替换均拒绝，恢复后Gate再验证通过 |
| make tp02-release-check | 预期exit 2：release target evidence NOT_RUN |

最终15/15组收尾检查PASS（含4项预期拒绝），见[原始台账](./evidence/tp02-local-20261013/final-01/results.json)。[26项实际探针](./evidence/tp02-local-20261013/final-01/actual-negative.json)逐字节恢复后重验通过；[实际wheel检查](./evidence/tp02-local-20261013/final-01/wheel-inspection.json)绑定本轮安装字节，嵌入catalog/service与源码相同、非editable。

本轮验证1298项输入（1297文件、1 Git link）与冻结Git字节一致；23154份基线历史证据、39份canonical原件和169份首次失败记录逐字节核对。无新真实来源授权或生产/正式验收。发布前[真实拒绝回执](./evidence/tp02-local-20261013/pre-admission/refusal.json)记录完整第二轮尚未完成时公共入口exit 2、全图0 READY。

## 未决风险及发布移交

13组检查归测试/RELEASE-GATE:BETA：f05-database、f05-volume、storage-database、storage-target、rls-target、f06-target、f07-recovery、f07-coverage、f07-service、f02-database、f02-sca、f09-target、tp01-baseline。保留实际Supabase可写/迁移/RLS/事务/Auth/Storage、持久Artifact/audit/恢复、部署JWT/权限、真实DataSnapshot/provider/LLM/tool、OS egress、获准真实来源用途、远程治理/漏洞库查询、P95接收<1s/容量/长稳/平台矩阵、候选同SHA hosted CI及ProjectUser正式确认要求；当前均未验收，不自行批准。

F01完整前端套件包含3项既有skipIf：TP03/TP04/TP05专用UI取消探针需对应桥接输入，普通pnpm test未提供时跳过。本轮不把它们计作PASS，且不授予这些消费者Gate；TP02本地验收与完整Python总结不因此缩减。所有live PostgreSQL保护入口在无DATABASE_URL/opt-in时跳过连接，这些返回不能记作数据库验收。

未升级订阅、未使用生产凭据、未推送/外部发布、未建立本机PostgreSQL/Supabase/Docker/临时数据库。源码与规范输入再次变化时撤回受影响READY，再从新冻结提交复验。

## 变更与下一任务

主要变更：Gate/记录器/55项专用测试、公共策略、计划顺序策略/42项负向、两份计划、前端handoff清单、操作规程及审计/失败证据；原TP02 Engine实现、fixture和锁文件未改动。最终[变更清单](./evidence/tp02-local-20261013/changed-files.txt)、[验证结果](./evidence/tp02-local-20261013/verification.json)和[封存摘要](./evidence/tp02-local-20261013/seal.json)随证据提交。

本地提交：`5e163d62` 初始实现；`135c7bd5` 阶段登记修复与首次失败封存；最终证据提交哈希在任务完成回复报告。

下一可执行任务：从新的干净冻结提交重新执行R1_LOCAL/A2/BFF003/BFF005/A3完整聚合闭包，恢复因公共输入变化撤回的五个消费者Gate；不复用本轮TP02索引冒充其他owner或候选。Supabase、外部环境及性能继续在测试/发布阶段实际验收。
