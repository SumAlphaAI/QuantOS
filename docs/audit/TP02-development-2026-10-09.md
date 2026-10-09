> 当前状态更新（2026-10-10）：TP03功能输入变化后，本报告的TP02准入为历史范围；当前TP02 NOT_ASSESSED，本轮不重新准入。见[TP03报告](./TP03-development-2026-10-10.md)。

# TP02 RD-Agent 自动研究/实验 Engine 开发验收

日期：2026-10-09。范围：R1 DEVELOPMENT；依据计划 TP02，结构化前置为 F08/F0。

## 当前结论

**TP02 DEVELOPMENT READY。** 冻结源码 `c3f86f5f4c5ded17ec1ce3cd6d7d4ca1bf81ebb8` 完成必要13节点/53唯一命令组的实际功能复评及递归内容校验；当前13 READY、146 NOT_ASSESSED、0 BLOCKED，formalAccepted=false。R1是阶段标签，R1-SERVICE整体Gate未关闭。TP01-C/D、R01/R02旧回执因输入变化撤销，本轮未重授；原正式用户确认与CI保留历史范围。

## 实现与边界

现有 upstream intake 明确替换为 fixture-backed QuantOS native provider。未接入 Microsoft RD-Agent、真实 LLM/工具、交易或生产秘密；原 v0.5.0/SHA 与 productionApproved=false 不变。

| 控制 | 交付 |
|---|---|
| 五 RPC 与两个 capability | hypothesis/experiment 映射自有 ResearchArtifact，fixture 类型错误拒绝 |
| 固定输入回放 | 同一请求 Execute 两次及 StreamExecute 两次，input/output/hash/ref 一致；prompt、catalog 与审计身份绑定 |
| 权限与边界 | Research-only、匹配 capability、严格字段/类型/范围和递归 secret/trading/network/authority 拒绝，两个 RPC 相同处理 |
| Artifact | 实际不可变 JSON 字节、完整字节 SHA256、tenant/workspace/actor 读隔离、内容寻址 mock URI；无虚构 Supabase 上传 |
| 生命周期 | scoped Cancel、等待/流式 deadline 与 transport 检查，取消确认后无新 Artifact 写入，写入/取消共锁 |
| 幂等 | 同 owner/run/key 改输入、capability、snapshot/policy 或 trace/request 身份拒绝，原对象不变 |
| 打包运行 | 实际 SDK/RD-Agent wheels、干净venv、仅锁定运行时依赖字节、离线安装、-I 独立子进程五RPC、两capability/回放/拒绝、子进程回收 |
| 准入 | 工程检查与统一manifest分离，绑定实际命令/源文件/日志/wheel字节和递归依赖；负向探针拒绝伪证据 |

DataSnapshot refs 是固定输入标签；本 Engine 不读取任意数据或执行允许工具，显式输出 snapshot_bytes_resolved=false/tools_executed=false。可信引用/质量/用途授权在既有 Runtime/R02 边界处理，不能将 ref 标签称为真实上游研究或真实快照字节验收。Artifact 和审计是内存 facade/metadata；持久化和已部署授权链另验。

## 组件与原始失败

- `engines/.venv/bin/python -m pytest engines/tests/test_rd_agent_contract.py engines/tests/test_rd_agent_development.py -q`：131/131；新增126，包括84个双RPC输入拒绝、8个非Research模式、14个身份冲突、6个取消权限、3个对象隔离、6个运行中停止、2个流式delta间停止、2个回放及导入边界。
- 全Python：433/433；Rust Manager RD-Agent契约：2/2；类型/静态检查通过。
- 首次组件回执因锁检查成功标记匹配错误被拒；修正为实际命令标记，10项命令结果与原拒绝完整保留于 `initial/component-lock-marker/`。
- 首次wheel验证缺少已锁定hatchling build组，补齐locked all-groups；第二次离线解析缺少registry索引缓存，改为仅复制已锁定grpcio/protobuf运行时发行包字节，再离线安装自有wheel。原失败完整保留，不声称联网安装或真实上游运行。
- [10组组件清单](./evidence/tp02-20261009/receipt.json)、[53组实际执行台账](./evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01/execution-results.json)、[TP02严格manifest](./evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01/core-tp02.json)、[F08](./evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01/core-f08.json)、[F0](./evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01/core-gate-f0.json)分别绑定当前源码、命令、实际日志/产物字节及递归依赖。
- F01三轮独立跨语言可重复构建及全量lint/test、F02数据库/Storage/RLS、F05一万事件与坏tick、F06真实认证/权限/Vault、F07恢复/覆盖和F09目标检查均为本轮实际执行；数据库使用已配置开发Supabase，未建立本地数据库。
- [16项组件证据负向](./evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01/logs/tp02-negatives.log)和[9项最终严格manifest破坏探针](./evidence/tp02-20261009/final-gate-probes.json)拒绝伪造命令/日志/输入/依赖/来源和正式声明；[最终检查](./evidence/tp02-20261009/final-checks.json)及[Git证据字节追踪](./evidence/tp02-20261009/git-evidence-tracking.json)单独保存。
- 后续提交仅补生命周期文档与执行证据，功能输入保持冻结c3f86f5。新源码hosted CI未执行，未推送。

- 文档收尾首次检查拒绝：将4个历史任务的必需“当前工程复核”字段改名，触发结构校验；恢复必需字段并在其内容内明确当前NOT_ASSESSED/历史范围。原失败保留于[文档字段检查](./evidence/tp02-20261009/initial/final-document-summary/final-checks.log)，功能源码和53组实际检查未改变。

## 风险与下一任务

真实上游/模型/工具、OS出站隔离、持久Artifact/audit、部署身份链、代表性P95<1s与长稳尚未验收；当前研究provider为受控fixture替换。不得使用生产凭据或执行外部发布。下一可执行开发任务为TP03（F08/F05/F0前置已当前READY）；R03仍须R02自身当前准入。仅生成本地提交，不推送。

F07本轮100任务恢复检查PASS；调度P95=1121.75ms，200ms目标仍未授予性能PASS。实际恢复与清理、覆盖/服务收尾见执行台账。

本轮F05实际10,000事件/副作用/派发/receipt一致，checkpoint=10001；消费627242ms，target-event-id-client-retrieval诊断33874.23ms（超过5秒目标，且非完整载荷链检索）。开发正确性PASS不授予RELEASE性能PASS；该风险明确保留。

## 执行命令与Gate

```sh
# Node 24.12.0 / pnpm 10.20.0；GITLEAKS_BIN 指向 artifacts/tools/gitleaks
node scripts/provider-a1-receipts.mjs --assess-tp02 docs/audit/evidence/provider-a1-remediation-20261004/tp02-admission-20261009/attempt-01
node engines/rd-agent/check-development.mjs --admit
node engines/rd-agent/check-development.mjs --ready
node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-functional-artifacts.test.mjs scripts/tp02-functional-artifacts.test.mjs
pnpm test:development-plans
pnpm test:p0
node scripts/check-development-plans.mjs
git diff --check
```

完整复评53/53 PASS（包含组件10组）；全量make test为Rust330、Python433、Web223通过，忽略的数据库场景不计作目标验收；聚焦回执86/86、计划负向38/38、P0策略16/16及最终9项破坏探针PASS。严格准入节点：`CORE:F01`、`CORE:F03`、`CORE:F04`、`CORE:F05`、`CORE:F06`、`CORE:F07`、`CORE:F08`、`CORE:F02`、`CORE:F09`、`CORE:TP01-A`、`CORE:TP01-B`、`CORE-GATE:F0`、`CORE:TP02`。其他146节点不因本次通过获得准入。源码提交为c3f86f5，最终证据提交见Git历史；均仅本地。

## 变更文件

主要代码为 `engines/rd-agent/src/rd_agent/{adapter,artifacts,research_artifact,service}.py`；新增开发测试、组件/打包验证和统一回执策略，更新README、核心/前端计划及progress。完整文件清单见[changed-files.txt](./evidence/tp02-20261009/changed-files.txt)，包含源代码提交与最终证据提交。
