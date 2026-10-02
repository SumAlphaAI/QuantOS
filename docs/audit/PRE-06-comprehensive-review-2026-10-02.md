# PRE-06 全面复审报告

> 日期：2026-10-02；状态：整改后工程复核PASS。初审与9项整改详情分别见[初审历史](./PRE-06-comprehensive-review-history-2026-10-02.md)和[整改验收记录](./PRE-06-remediation-2026-10-02.md)。

## 一、任务完成概况

按执行计划的PRE-06测试基线逐项复核，原9项问题全部关闭。20项工程控制点PASS20、PARTIAL0、FAIL0，完成率 **100%**；当前未解决问题：阻塞0、高危0、中危0、低危0。

验收范围为仓库工程门禁与macOS本地Web mock重放。Linux已验证12张基线完整，当前Linux浏览器执行、远端CI/上传回执、正式G0与指定模型复审、风险/QA/设计owner签署、真实staging/provider/BFF/IdP/Sentry/账号、数据库、全业务及Desktop/native均为 **NOT RUN / NO RECEIPT**。本轮没有数据库操作。

## 二、完成情况明细统计

| 控制点 | 验收要求 | 当前证据 | 状态 |
|---|---|---|---|
| C01 | 一期官网/Web Terminal及Desktop隔离 | 两应用Web-only；Desktop保留二期边界 | PASS |
| C02 | 锁定工具链、依赖、测试命令和目录 | Node24.12.0/pnpm10.20.0冻结离线安装与28项重放 | PASS |
| C03 | 同源OpenAPI/schema/MSW生成与漂移检查 | OpenAPI1.3.0、62操作/51schema，generated与coverage检查通过 | PASS |
| C04 | MSW授权/错误/未配置操作语义 | 17项contract，四resolver成功/错误及未实现501语义受检 | PASS |
| C05 | fixture集合可枚举、逐项schema与安全受检 | 10项全量登记与正负校验，2个inventory隔离，未知/敏感注入拒绝 | PASS |
| C06 | schema故意破坏必检出 | schema负向和四种sabotage通过 | PASS |
| C07 | 冻结权限不变量故意破坏必检出 | executable=true拒绝，关键权限政策100% | PASS |
| C08 | 敏感字段负向扫描可靠 | 字典分隔符/大小写/嵌套对象和数组别名拒绝 | PASS |
| C09 | 两应用三浏览器CI项目与隔离配置 | 两应用三浏览器配置及CI步骤/输出/trace政策验证 | PASS |
| C10 | 当前目标浏览器功能与视觉重放完整 | macOS六组135/135、零失败/跳过/flaky；Linux仅inventory | PASS |
| C11 | axe严重/高等级违规阻断基线 | 官网/Terminal现有serious/critical axe阻断用例通过 | PASS |
| C12 | 390px、200%缩放及键盘基线 | 390px、200%缩放、键盘用例通过 | PASS |
| C13 | 实际PNG inventory/hash/尺寸/0.5%阈值及破坏 | 24PNG；Linux/macOS各12，尺寸/hash和0.5%阈值及真实像素破坏拒绝 | PASS |
| C14 | 页面像素比较断言可删除时必须被拒绝 | 删除截图比较时结构、浏览器及独立sabotage非零 | PASS |
| C15 | 两应用完整构建性能预算持续阻断 | 两应用共享/chunk/CSS与逐路由预算；空产物/超预算/旧回执拒绝 | PASS |
| C16 | CI真实步骤/关键测试删除负向保护 | 停用CI、注释命令、恒真contract被实际进程拒绝 | PASS |
| C17 | CI不得用重试掩盖flaky | CI真实配置两flaky探针均exit1 | PASS |
| C18 | 全局80%与关键风险分支100%验收机制 | 全局行≥80%；五文件各四维100%，未测分支实际拒绝 | PASS |
| C19 | 失败报告/trace/视觉附件可归档 | 两CI always/14天归档结构受检，本地真实trace/diff存在 | PASS |
| C20 | 总结/计划状态与当前验证身份一致 | 总结/计划/初审历史与当前源码哈希、执行证据同步 | PASS |

最终28项重放全部退出0；单元187、契约17、门禁负向15、浏览器135项通过。全局行覆盖率 **81.27%**；关键五文件111/111行、126/126语句、27/27函数、98/98分支，各文件四维100%。详见[任务矩阵](./evidence/pre06-remediation-20261002/task-matrix.json)和[源码/证据绑定](./evidence/pre06-remediation-20261002/manifest.json)。

## 三、问题清单及风险分析

当前无待整改问题。9项已关闭内容保留在[关闭台账](./evidence/pre06-remediation-20261002/issue-closure.json)及整改记录，初审证据不改写。当前工程结果不能推断远端CI、正式owner签署或未来业务已通过，执行身份与范围见第一部分。

## 四、整改建议

本次整改完成。后续新增fixture、关键分支、平台或预算时同步清单与正负验证，执行计划中的正式目标验收另取独立回执；不复用历史SHA、候选图生成或自动重试结果作为通过证明。
