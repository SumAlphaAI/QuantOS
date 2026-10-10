# TP05 OpenBB 数据/研究适配服务开发验收

> 当前性注记（TP08 刷新后）：下文为 TP05 冻结源码的历史结果。本轮 TP08 输入变化后 TP05 stage_gate 为 NOT_ASSESSED，未转授准入；当前状态见 [TP08 报告](./TP08-development-2026-10-10.md)。

日期：2026-10-10。R1 DEVELOPMENT；必要前置F05、F08、F0。

**TP05 DEVELOPMENT READY**。冻结源码`4875b1405a472a787f0d3f5543db87e06c9a6957`的必要13节点/53唯一命令组全部实际PASS，严格递归内容校验通过；当前13 READY、146 NOT_ASSESSED、0 BLOCKED，formalAccepted=false。F05/F08/F0均本轮重评；TP02/TP03/TP04、TP01-C/D、R01/R02本轮未重授准入。R1-SERVICE整体、正式ACCEPTED、hosted CI与发布独立。本轮不加载OpenBB upstream，不取得法律/生产/外部数据用途许可，不使用生产凭据或执行外部发布。

代码、测试、许可证与隔离Gate、原始失败和验收证据均纳入本地Git。后续仅更新文档与证据，功能输入保持冻结4875b140。

## 已完成工程范围

QuantOS自有mock与OpenBB-evaluation标签的五RPC fixture provider，versioned Data Contract/record JSON Schema，100实际UDS双Execute/双Stream重放，完整Artifact字节哈希与scoped读隔离。缓存绑定tenant/workspace/actor/workflow及完整input/metadata、fixture和license-policy；128项TTL LRU，读副本与并发隔离。取消/期限/执行身份及不可变双Artifact原子提交已验证。只允许Research及local/test环境；交易、生产/staging、未批准工具和递归authority/order/secret/network字段拒绝且固定机器码与scope hash审计。

生产构建实际拒绝包含OpenBB或当前评估adapter，在sync/build前终止；生产manifest亦调用排除Gate。开发wheel独立-I进程五RPC、取消<2秒、生产拒绝、无upstream package通过。许可证policy已与既有tag4.4.5/commit34de2f61427f2879df4ebbf5906ca0508c6e84f3对齐；没有取得AGPL/商业或实际数据用途许可。

最终13组组件通过：TP05 259、全Python1252、Manager2、Runtime工作流3、100实际schema/4破坏、UI3项无skip、wheel、生产Gate8项、Ruff/11文件format/Pyright、locks/intake。全仓lint、计划负向38、P0策略16通过；必要13节点/53组实际复评已完成。历史TP03/TP04 Gate已撤销，不转授当前源码。


## 实际命令与验收证据

```sh
node engines/openbb-adapter/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp05 docs/audit/evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02
node engines/openbb-adapter/check-development.mjs --admit
node engines/openbb-adapter/check-development.mjs --ready
make test
node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-functional-artifacts.test.mjs scripts/tp02-functional-artifacts.test.mjs scripts/tp03-functional-artifacts.test.mjs scripts/tp04-functional-artifacts.test.mjs scripts/tp05-functional-artifacts.test.mjs
node --test scripts/tp05-release-gate.test.mjs
pnpm test:development-plans
node --test scripts/p0-acceptance-negative.mjs
node docs/audit/evidence/tp05-20261010/final-gate-probes.mjs
node docs/audit/evidence/tp05-20261010/final-checks.mjs
python3 docs/audit/evidence/tp05-20261010/git-evidence-tracking.py --check-commit
```

[53组完整执行台账](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02/execution-results.json)、[TP05严格manifest](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02/core-tp05.json)、[F05](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02/core-f05.json)、[F08](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02/core-f08.json)、[F0](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-02/core-gate-f0.json)绑定本轮源码、实际命令、日志、wheel、输出及递归依赖。严格13节点：CORE:F01/F03/F04/F05/F06/F07/F08/F02/F09、CORE:TP01-A、CORE:TP01-B、CORE-GATE:F0、CORE:TP05。

[组件13组](./evidence/tp05-20261010/receipt.json)全部PASS。`make test`：Rust333、Python1252、Web229通过；[全量统计](./evidence/tp05-20261010/full-test-summary.json)说明默认Rust2项ignored、无数据库配置提前返回与Web3项默认桥接skip不作为目标验收，TP05专项UI3/3无skip。聚焦回执161/161、生产构建Gate8/8、计划负向38/38、P0策略16/16、[严格证据破坏探针9/9](./evidence/tp05-20261010/final-gate-probes.json)、[最终检查](./evidence/tp05-20261010/final-checks.json)通过。

独立安装wheel进程五RPC，取消 **12.68ms**；[实际UDS/UI响应桥接](./evidence/tp05-20261010/ui-cancel.json)取消 **12.65ms**，Artifact delta=0。仅代表当前本地开发环境，不授予已部署HTTP/UI链路或生产取消SLO。

F01三轮独立构建和全量lint/test通过。数据库结论来自本轮已配置开发Supabase的目标执行：F02/F05迁移/DB/Storage/RLS、F06实际Auth/BFF/Runtime/执行权限/Vault及8项DB测试、F07恢复、F08实际服务、F09 cron/故障/容量/trace等。清理回执保留；没有创建本地数据库。

F05事件/receipt/派发/唯一副作用各10,000，checkpoint=10001；消费537963ms，event-ID-client-retrieval诊断20574.52ms。该诊断不代表完整payload链或代表性P95。

F07本轮100任务恢复完成、100唯一Artifact绑定；调度P95诊断 **924.01ms**，目标200ms。恢复正确性PASS不授予性能PASS。

[Git证据追踪](./evidence/tp05-20261010/git-evidence-tracking.json)核对执行台账的所有引用字节，提交后再次核对Git保存内容；[报告链接核对](./evidence/tp05-20261010/report-links.json)保留。本轮未推送，候选hosted CI未执行。

## 初始失败与修复

首次UDS输出测试100失败/150通过：Protobuf Struct将整数TTL读成double，原response_hash不能通过实际wire往返；canonical hash增加整值数字归一化后全部通过，[原始失败](./evidence/tp05-20261010/initial/response-hash-wire-number.log)保留。组件记录器初始selector/import路径配置错误及旧组件回执与新测试计数不符的负向失败保留于initial目录，未发布READY。

Rust集成1通过/1失败发现新生命周期漏掉evidence_refs；恢复两条实际Artifact引用并加入100样本映射断言，[原始失败](./evidence/tp05-20261010/initial/component-evidence-refs/manager.log)保留，当前Manager2/2通过。schema_hash由字段指纹改为实际随wheel分发的dataset record JSON Schema canonical字节hash；100样本独立Ajv校验通过。

首个冻结9844812c的实际复评中，`make test`在Rust阶段327通过/3失败，未执行该命令的Python/Web阶段：新增Data Contract scope被直接传入LLMQuant，触发既有递归authority拒绝。已改为Runtime先验证tenant/workspace/actor和Research用途，再仅转发闭合元数据；完整原始契约仍归档，Engine拒绝边界不放宽。新增3项Rust单元测试及实际工作流回归。[旧执行台账](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-01/execution-results.json)、[原始失败](./evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-01/logs/f01-test.log)保留。

独立真实中文UDS探针发现Python默认ASCII转义与JS UTF-8 canonical hash不一致；统一UTF-8并新增中文/emoji/非ASCII actor三项回归，100组实际schema矩阵和独立wheel均加入非ASCII输入。[中断范围与原因](./evidence/tp05-20261010/initial/interrupted-admission-01/interruption.json)、[原始UTF-8回归](./evidence/tp05-20261010/initial/interrupted-admission-01/unicode-regression.log)、[已清理进程](./evidence/tp05-20261010/initial/interrupted-admission-01/process-cleanup.json)保留。旧15组回执含1组失败，仅作历史，不授予READY；修复后重新冻结并完整重评53组。

修复后冻结前完整`make test`通过：Rust333、Python1252、Web229；默认跳过项不计为数据库或部署验收，完整日志保留于initial/preflight-full-test-fixed.log。该预检未授予准入；本轮新冻结源码的53组重评已另行执行通过。

## 未决风险和下一任务

真实OpenBB runtime、resolved依赖/CVE、法律结论与实际provider数据权限待验；两种标签当前都是QuantOS synthetic fixtures，无外部数据查询、工具执行、已认证source bytes或live freshness结论。持久Artifact/audit、部署HTTP/BFF/browser链、OS出站隔离、代表性负载/P95/长稳与生产取消时限未验。F05/F07历史性能风险不因本轮正确性消失，本轮实际指标见上方，风险仍保留。formalAccepted=false，未推送/hosted CI/生产凭据/发布。

下一可执行任务：TP08 Qlib限定范围评估（F05/F0当前严格READY），仍需完成自身固定commit、许可证/SBOM/CVE、3个离线实验映射与明确接入结论。R03仍需R02/TP02自身当前准入。

## 变更文件与Git

主要改动：`engines/openbb-adapter/src/openbb_adapter/{adapter,artifacts,fixtures,license_gate,providers,service}.py`及versioned Data Contract/record schemas，Python/Rust集成验证、Research UI测试、组件/wheel/schema/UI/生产制品Gate脚本，Makefile与manifest构建入口，统一回执策略，核心/前端计划、ADR、README、操作进度与验收证据。完整清单见[changed-files.txt](./evidence/tp05-20261010/changed-files.txt)。

实现源码提交9844812c，作用域与UTF-8修复提交4875b140，最终证据提交见Git历史；均仅本地。
