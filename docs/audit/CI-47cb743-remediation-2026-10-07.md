# 47cb743 CI 整改与当前工程复评

> 日期：2026-10-07；修复及工程冻结源码 `d00041ee354701a08fa7483e948b74f374439b13`；阶段 DEVELOPMENT。最终文档/证据提交按功能内容绑定核验，不声明同 SHA hosted CI 或 RELEASE 通过。

## 一、任务完成概况

已修复主 QuantOS CI 在 F02 隔离重建时的 `storage.buckets.file_size_limit` 缺列根因：F02/F05 的 runner 数据库 Gate 共用完整桶定义，新增强制迁移兼容回归。原 `verify-download` 下游拒绝是主构建/签名被跳过后的正确 fail-closed 行为，保持原门禁。

原 hosted CI 为9个工作流8 PASS/1 FAIL，见[原验收报告](CI-47cb743-acceptance-2026-10-07.md)。修复后的本轮工程回执、A2准入均严格有效；当前全计划 **26 READY、0 BLOCKED**。项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。 **新候选 hosted CI 尚未执行**。

## 二、完成情况明细统计

| 检查范围 | 实际结果 | 证据与统计边界 |
|---|---|---|
| 共享 fixture / 全部桶迁移列 | 通过 | F02/F05复用同一DDL；新增静态检查纳入 `make f02-check` |
| 聚焦F02负向/恢复 | 初轮23 PASS、1数据库用例默认跳过 | [初轮日志](evidence/ci-47cb743-remediation-20261007/f02-focused-negative-initial.log)；跳过用例不算数据库PASS |
| Supabase临时事务实际回归 | 5 PASS、0 FAIL、0 SKIP；结束ROLLBACK | [实际日志](evidence/ci-47cb743-remediation-20261007/storage-target-pass.log)：旧DDL拒绝SQL42703、全部桶INSERT编译、重复upsert/私有性/16MiB；既有CA且TLS验证开启 |
| F0/A1完整工程 | 87个唯一命令组有效结果87 PASS | [初轮87组](evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007/execution-results.json)为86 PASS/1 FAIL；协议I/O失败组在同冻结源码完整补测PASS，共87+1个独立命令组执行，非一次87/87无失败；21基础/准备回执经标准严格校验器发布 |
| 一万事件链完整补测 | PASS | [完整同源补测](evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007/f05-volume-rerun-1.json)、[实际测量](evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007/f05-volume-rerun-measurements-1.json)；原失败不改写、不擅自扩充自动重试策略 |
| 身份/Audit | 各三组语义、8/5业务变异拒绝通过 | [原执行清单](evidence/ci-47cb743-remediation-20261007/refresh-execution-results.json)、[后续执行](evidence/ci-47cb743-remediation-20261007/refresh-completion-execution-results.json)；127项不同门禁负向PASS（身份22+44、Audit30、A2聚合31），149次实际用例执行包含22项TAP重跑，与子组统计重叠 |
| A2聚合 | 3实际命令组PASS，26API覆盖/3依赖严格READY | [当前聚合](evidence/provider-a2-remediation-20261007/ci-47cb743-reassessment-20261007/provider-a2.json) |
| G0/FEP-0 | 16/16及2/2工程PASS | 项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。 用户确认与工程执行分别记录，确认后FEP-0又实际重评两项PASS |
| 当前内容及依赖闭包 | 26个受影响节点全部严格核验 | [闭包核验](evidence/ci-47cb743-remediation-20261007/closure-verification.json)；当前26 READY、0 BLOCKED、133 NOT_ASSESSED、formalAccepted=false |
| A2旧目标复用 | 身份51调用/14强断言；Audit83调用/45断言 | 7+13目标源码逐项匹配原不可变提交/当前文件，清理回执有效；本轮未重跑业务目标调用 |

所有需要数据库的本机检查连接既有配置Supabase，未安装或运行本地PostgreSQL/Supabase/Docker。GitHub runner的F02/F05隔离数据库完整重建仍须新候选hosted执行；Supabase临时事务回归与目标漂移/RLS通过不代替该远端重建验收。

一万事件补测实际记录10000事件、10000分发、10000应用回执及10000唯一副作用，checkpoint=10001；消费耗时588651ms，目标身份链检索21907.827875ms、scope=`target-event-id-client-retrieval`。该跨区域ID检索不是完整载荷≤5秒性能验收。

你的[原始确认记录](../gate-records/G0-user-confirmation-2026-10-07-52fee5f6e499.json)已绑定当前文稿及范围摘要；确认后的[最新 FEP-0 回执](evidence/fep0-remediation-20261005/ci-47cb743-user-confirmed-20261007/fep0.json)包含两项重新执行结果。

文档更新后的联合计划检查及38项负向全部PASS，业务要求与依赖输入保持不变，见[最终检查记录](evidence/ci-47cb743-remediation-20261007/final-checks.json)。首次两条检查误用了系统pnpm，启动失败原件保留；使用完整工程验收所用pnpm后实际通过。新证据目录敏感信息扫描全部PASS。额外全docs目录扫描报告137条历史记录，逐文件证明全部字节与冻结提交相同、没有本轮新增/修改文件命中，见[扫描边界记录](evidence/ci-47cb743-remediation-20261007/broad-docs-secret-scan-boundary.json)；该额外扫描不记作全docs无发现PASS。

## 三、问题清单及风险分析

| 模块 / 问题 | 修复与状态 | 影响及剩余边界 |
|---|---|---|
| F02/F05 CI Storage fixture缺列 | 源码已修复，两个Gate共享DDL；旧结构失败/新结构通过的实际数据库回归有效 | 原问题阻断完整迁移及后续构建/签名；新候选远端CI待执行 |
| verify-download主线下载拒绝 | 无需降低门禁 | 原主签名未运行，下游拒绝正确；新候选须完整签名/下载验签通过 |
| 本轮F05 volume PostgreSQL协议I/O | 原失败保留，冻结源码完整一万事件链补测PASS | 传输中断不记作业务断言PASS；有效回执绑定真实完整补测和原失败记录 |
| 首次聚焦TLS证书链拒绝 | 原失败保留，使用工程既有CA且验证开启后PASS | 首次连接未开始测试事务，不计数据库PASS |
| 身份回执输出格式拒绝 | 原22项测试PASS，默认reporter缺少TAP标记；以显式TAP完整重跑22项后严格发布 | 原回执发布失败与原日志保留，校验器不改、已通过同源语义/阶段/变异复用 |
| G0范围人工确认 | 项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。 | 根据功能范围摘要处理，旧b2确认不自动迁移 |

本轮定位TLS配置时一次搜索误覆盖私有环境文件，工具输出暴露三组测试角色数据库凭据；没有将凭据写入报告、日志证据或Git。已告知项目用户，建议轮换这三组测试凭据；本次未自行执行永久账户变更。

## 四、整改建议与后续

推送最终候选后验收其完整SHA的全部必需hosted工作流及主QuantOS CI：隔离重建/漂移/RLS、F05数据库Gate、构建打包、主线签名和下载验签。当前本机工程PASS不替代同SHA远端/正式ACCEPTED、staging、性能/长稳或RELEASE。

项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。 范围变化按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)第5步重新确认，文稿为[当前G0文稿](../gate-records/G0-user-confirmation-draft-2026-10-07-52fee5f6e499.md)。保留原 hosted 失败、完整初轮失败、TLS失败、旧计划/报告/确认快照和旧目标原件。

聚焦源码字节核验见[聚焦记录](evidence/ci-47cb743-remediation-20261007/focused-verification.json)，最终目录摘要见[证据索引](evidence/ci-47cb743-remediation-20261007/evidence-index.json)。
