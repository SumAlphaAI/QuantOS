# CORE-GATE:R1 当前研究闭环评估结果

2026-10-26，在QuantOS `main`完成当前评估、功能修复、定向测试和计划同步；源码提交`921a125c48e0f493c4f15fb12b7ac03b4e625eba`，起始基线`c98b7592c1ca9edb9c7972b03d3c8ae2197a723c`。本目录随单独本地证据提交保存，不push、不部署、不外部发布，未使用生产凭据或数据库。当前工程Gate **PASS_OWNED_LOCAL_R1_RESEARCH_LOOP**；完整R1 **NOT_READY_GAPS_OPEN**，INTEGRATION **NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。

## 变更与执行结果

[17项代码/测试/入口/计划/规程变更文件](changed-files.md)，[当前规程](../../../operations/core-r1-current-assessment.md)，[主计划](../../../SumAlpha-QuantOS-Development-Plan.md#acceptance-core-gate-r1)。修复R04的Vibe来源准入、checkpoint请求保留/同键重放覆盖、Manager非确定protobuf map指纹及workspace绑定、Signal冻结时钟与未来/过期拒绝。新增cfg(test)真实R03→R04研究组合宿主和Web/Audit测试；生产BFF路由尚未实现。

| 当前验证 | 实际结果 |
| --- | --- |
| Runtime与Manager | 51/51通过；嵌套map重建16次、跨workspace/内容冲突、原生引擎、来源校验、Research取消/成功和Signal有效期边界 |
| Manager持久幂等补充 | 2/2通过：新格式本地账本在Manager重建、进程被终止后恢复；非目标数据库或业务持久重启 |
| Python原生研究引擎 | 714/714通过：RD-Agent、LLMQuant、TradingAgents contract与开发测试 |
| Python Vibe | 204/204通过：contract、100安全负向、20固定workflow、取消/deadline、移除后其他engine启动、ResearchArtifact投影 |
| Node Gate/阶段负向 | 61/61通过，含37项R1边界/浏览器结果拒绝测试 |
| Chromium R1 | 23/23通过：20个Vibe、RD正常、RD及Vibe各1次缺失Proposal路由后恢复；累计506次来源拒绝 |
| Chromium U01定向回归 | 5/5通过，共享宿主/fixture的认证、读取/取消/拒绝路径 |
| 编译/静态 | 当前BFF测试宿主编译、Rust格式、定向TS/Node lint、计划结构、diff whitespace通过 |
| 阶段与下一项 | 完整R1 INTEGRATION入口预期退出1/STAGE_NOT_READY；CORE:S04 DEVELOPMENT allowed=true |

[完整实际命令](commands.md)、[19组执行记录](attempt-01/executions.json)、[补充2组记录](supplement-01/executions.json)、[严格回执](receipt.json)、[源码/导出输入](attempt-01/inputs.json)、[全证据hash清单](manifest.json)。运行`node scripts/core-r1-review.mjs --verify`复核主矩阵；运行`node docs/audit/evidence/core-r1-local-20261026/verify.mjs`复核主矩阵、补充结果及全部文件。Python/Node/Chromium均无失败、跳过或flaky；Rust有明确筛选的未选测试，不将其记作运行通过。

本轮新编译Runtime/Manager/宿主。Web产品与依赖输入不变，静态导出复用U01原源码`4d5362e1cca41a72f826c80e3c7f41f9c430f56d`，核对原buildId和182个当前导出文件hash；不改记为本轮新构建。不可变R04历史矩阵仅是contract输入，源文件也绑定到候选，不称目标证据。

## 适用范围与缺口

实际执行R03/RD或Vibe Python UDS→R04/LLMQuant→TradingAgents；断开Proposal路由后第一次尝试保留signal_ready，补路由和同进程克隆内存状态后第二次成功；Signal/Proposal各保留1份，completed同键重放不降级，Proposal明确executable=false、有counter_views，无订单/执行能力注册或浏览器订单请求。OpenBB未注册，也未取得其用途许可。

Research、Signal和Proposal完整主记录的canonical字节摘要，源snapshot元数据摘要，以及附属Artifact manifest摘要进入reference C10因果索引。浏览器从真正的Audit events读取scopeHash，并核对原canonical字节及解析记录。Rust浮点`1.0`不能由JavaScript重新编码的`1`替代。附属Artifact只承诺manifest，实际附属内容、native Signal/Proposal C04目录/Storage尚未接入。共享网络回执的businessWrites保留旧RD通用标签；具体engine以每场景`r1-chain.json`内R03 capability、真实输出fixture及native链记录为准，不能只据该旧标签判断Vibe场景。

显式替代端口：reference身份cookie桥、临时自签TLS/CORS、内存C03/C04、测试宿主BFF→worker run映射与研究→R04调度、reference C10投影。研究恢复只在同进程克隆Runtime/repository并重建coordinator，Manager保持原实例；不能称为业务进程重启验收。两个Manager补充测试也不扩大为整条链恢复通过。

未决项保留在原R1范围：生产BFF到R04路由、真实身份与Cookie/CORS、持久队列/Storage/Audit、完整Artifact内容与目录、跨进程重启及完整取消/deadline组合、完整浏览器/人工可访问性和全业务联调。旧Manager持久指纹与旧progress-only checkpoint的迁移未执行，维持fail-closed；不自动接受旧opaque指纹、不删除事实。Supabase目标、实际外部数据/用途许可、远端fork治理、性能/长稳、目标部署/回滚、同SHA远程CI与发布均NOT_RUN。未执行全仓或历史递归闭包，没有升级上游Gate或改绑历史READY。

## 失败与修复记录

- `preflight-01`保留首次宿主编译失败：Audit调用缺少source参数，已修复后编译。
- `exploratory-01`保留RD恢复时Manager幂等冲突：输入protobuf map顺序不稳定；改为有序Value并绑定workspace后恢复可执行。
- `exploratory-02`保留测试错误：因果图响应不含redactedPayload，改读events接口核对承诺。
- `exploratory-03`保留canonical摘要探测失败：浮点重编码差异，改为原canonical字节加解析内容双重检查。
- `exploratory-04`三项探测通过，仍为未提交诊断，不代替冻结验收。
- `preflight-03`保留外层清单首次验证失败及初始manifest：Python按Path组件排序与JS完整字符串排序不同；改为完整路径字典序，不改变候选测试结果或hash。
- `preflight-02`保留未固定pnpm launcher尝试registry失败；冻结执行使用离线固定缓存，lint通过。

上述均为未提交工作区诊断，不能因日志中的baseline SHA将其改绑为源码候选通过；候选通过只来自`attempt-01`和补充记录，失败未覆盖或拼接。

下一可执行原任务：**CORE:S04 策略审批与Terminal Strategy页面（DEVELOPMENT）**。完整R1四项清单仍未勾选，正式checkpoint review_status=NOT_STARTED、source_commit=null，stage_gate保持NOT_ASSESSED；此报告不构成正式ACCEPTED、运行放行或发布授权。
