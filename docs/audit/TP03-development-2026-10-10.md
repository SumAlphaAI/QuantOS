# TP03 LLMQuant Signal Engine 开发验收

日期：2026-10-10。依据核心计划 TP03；范围 R1 DEVELOPMENT，必要前置 F08、F05、F0。

## 当前结论

工程实现完成，严格阶段准入待冻结源码复评。原13个 READY 已撤销为 NOT_ASSESSED；历史回执、正式确认和原CI保留，不迁移到新源码。当前0 READY、159 NOT_ASSESSED。R1-SERVICE整体、正式ACCEPTED、hosted CI和发布分别验收。

## 实现与证据边界

LLMQuant 是第三方项目名称，本轮为 QuantOS 自有受控 fixture adapter；未选定外部 upstream repo/version/commit，未加载模型权重，未改第三方 baseline。现有 native intake 的 productionApproved 不代表外部软件或部署授权。

| 控制 | 交付与可验证行为 |
|---|---|
| Engine 契约 | 五RPC、quant.signal.v1、自有Signal/ModelDiagnosticsArtifact；Rust Manager与Runtime既有信号/提案链兼容 |
| 固定输入 | 100组实际UDS输出，逐条JSON Schema校验；Execute两次、StreamExecute两次回放一致 |
| 版本与时效 | strategy/model/data版本、置信度、fixture定义真实digest；生成时间绑定command issued_at，TTL来自fixture |
| 边界 | Research-only、匹配capability、release/feature必需且snapshot/policy一致；递归OMS/venue/secret/network/authority拒绝；禁止相关import |
| Artifact | Signal/model不可变原子bundle、实际完整字节SHA、tenant/workspace/actor读隔离、mock URI |
| 生命周期 | owner-scoped Cancel、command/transport deadline、输入/身份冲突拒绝；取消确认后无新增Artifact写入 |
| 独立服务 | 离线安装实际SDK/LLMQuant wheel到干净venv，-I独立进程五RPC及运行中取消<2秒；子进程回收 |
| UI与准入 | Research UI取消状态/迟到事件无副作用；实际UDS响应桥接3项无skip；命令、日志、wheel、100条输出和依赖内容绑定；22项证据破坏探针 |

Signal明确输出 trade_executable=false、release_resolved=false、snapshot_bytes_resolved=false、tools_executed=false、upstream_runtime_loaded=false。策略/feature引用是输入标签，模型digest仅覆盖fixture定义；无真实特征计算、训练或推理质量声明。历史Research回放时效采用已绑定命令时间，不能据此声称当前可交易；当前有效性、可信引用、质量和用途许可由Runtime/消费者验收。

UI证据是本地真实UDS取消回执到既有Research状态处理器的响应桥接；未执行已部署BFF HTTP/browser E2E。常规web检查未提供桥接回执时会跳过该集成项；明确桥接命令要求3/3无skip。

## 检查与原始失败

组件12组覆盖：273项LLMQuant契约/开发、全Python699项、Manager2项、Runtime3项、100条实际schema与4项schema破坏、UI桥接3项、独立wheel服务、Ruff/format、Pyright、锁文件与第三方intake。实际结果见[组件回执](./evidence/tp03-20261010/receipt.json)。

初次边界测试4 FAIL/250 PASS：测试请求构造器错误地把冲突payload policy/snapshot回填为外层权威字段；已固定独立外层字段，补充缺失引用与fixture篡改用例。原失败见[原始日志](./evidence/tp03-20261010/initial/boundary-builder.log)。初轮261项工程回执保留于[首轮记录](./evidence/tp03-20261010/initial/preflight-record/receipt.json)，后续增加嵌套policy与provenance标量类型校验；首轮记录不作当前准入。

```sh
node engines/llmquant/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp03 docs/audit/evidence/provider-a1-remediation-20261004/tp03-admission-20261010/attempt-03
node engines/llmquant/check-development.mjs --admit
node engines/llmquant/check-development.mjs --ready
node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-functional-artifacts.test.mjs scripts/tp02-functional-artifacts.test.mjs scripts/tp03-functional-artifacts.test.mjs
pnpm test:development-plans
pnpm test:p0
```

必要依赖闭包13节点、53唯一命令组将对冻结提交实际执行，数据库仅使用已有开发Supabase配置，不建立本地数据库。实际数据库执行与静态检查单独记录。最终manifest/执行台账、9项严格破坏探针、Git字节追踪和实际测量将在复评后补齐。

新增四项双RPC回归：改变policy引用的两项真实复现Artifact标识冲突；另外两项初始断言错误地要求相同内容在不同幂等键下不去重（[原始日志](./evidence/tp03-20261010/initial/artifact-identity.log)）。初次同时绑定幂等键触发Runtime重放哈希回归（2 PASS/1 FAIL，见[原始日志](./evidence/tp03-20261010/initial/identity-replay-regression/runtime.log)）；最终仅将外层policy引用纳入Artifact内容标识，保留同内容去重和Runtime重放。最终四项及完整12组组件已重跑通过（273/全Python699、Runtime3）。冻结7a1923a9的首轮准入在F01结束、F06仍构建阶段停止，未执行目标数据库场景，未发布READY；[未完成记录](./evidence/tp03-20261010/initial/interrupted-admission-01/interruption.json)保留，后续在新冻结源码重跑全部检查。

一次聚焦证据测试与组件回执写入并行，读取到上一轮FAIL回执而拒绝（[原始日志](./evidence/tp03-20261010/initial/negative-during-record.log)）；组件结束后按顺序重跑，最终109项结果单独保存。

第二轮冻结b0f90059实际完成52/53组；TP03负向22项因整体Git文件清单1,050,477字节超过Node默认1MiB缓冲区而在读取阶段失败，严格门禁拒绝发布READY。原[完整台账](./evidence/provider-a1-remediation-20261004/tp03-admission-20261010/attempt-02/execution-results.json)和[失败日志](./evidence/provider-a1-remediation-20261004/tp03-admission-20261010/attempt-02/logs/tp03-negatives.log)保留。新增超过1MiB清单的真实临时Git仓库回归（[修复前失败](./evidence/tp03-20261010/initial/inventory-buffer-regression.log)），将功能清单和独立ProtoJSON bootstrap的整仓Git读取缓冲区提升到32MiB，保持选择器/内容校验不变；新源码须重新执行全部53组。

## 风险与下一任务

真实upstream/模型权重/特征计算、OS出站隔离、持久Artifact/audit、已部署身份与HTTP/UI链、代表性P95/长稳和部署负载取消时限待验；F05/F07既有性能风险不因开发正确性通过消失。不得使用生产凭据或执行外部发布。本轮生成本地提交，不推送。

下一可执行任务：TP04（需要本轮TP03/F08/F0严格READY后进入开发）。R03仍依赖R02自身当前准入。

## 变更文件

主要代码 `engines/llmquant/src/llmquant/{adapter,artifacts,fixtures,signal_mapper,service}.py`；新增开发/Research UI测试、组件/独立wheel/schema/UI桥接验证及统一回执策略，更新README、核心/前端计划和操作进度。完整清单见本轮证据目录 changed-files.txt。
