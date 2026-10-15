# SERVICE:S04 本地开发准入

SERVICE-S04_LOCAL仅发布SERVICE:S04的DEVELOPMENT READY。直接依赖S01、S02、S03、F06、R1-SERVICE，完整展开36节点；同一新冻结候选重新执行115组依赖，再运行3组自身检查，共118组。不拼接历史READY；共享功能输入变化使S03旧独立准入撤回，历史原件保留。

预检 `QUANTOS_SKIP_ENV=1 make service-s04-check`；全部功能输入提交且工作区干净后 `QUANTOS_SKIP_ENV=1 make service-s04-assess-local`。失败必须选择全新attempt-NN。记录器剥离数据库、凭据和外部测试开关，离线构建依赖，真实TCP/UDS须有本机IPC权限；公开包元数据验证不代表生产连接。三次独立构建和make lint/test及全部依赖绑定同一冻结SHA。

6项真实HTTP测试覆盖：自有Python UDS生成102个Artifact到S01/S02/S03完整成功链与两种原生adapter重放；100次未验证/未审批拒绝；tenant/workspace/成员权限/session和身份伪造；静态失败、版本冲突与恢复；20路审批只有1成功、拒绝决定/hash/TTL及消费过期拒绝；100次来源伪造与body/分页/目标限制。成功/拒绝均有作用域审计，原始日志保存实际Release、报告及审计JSON。独立门禁测试检查缺依赖/混SHA/跳过/证据篡改/越界声明和三文件发布失败回滚。

记录器备份并恢复canonical组件输出的原字节和原有存在性，本轮生成内容保存在attempt；完整通过后才事务性写入本任务manifest和两份计划。`make service-s04-local-check`复核当前输入，`make service-s04-release-check`应拒绝缺少真实发布回执的状态。

API（JSON字段snake_case，错误仅code/correlation_id；身份仅Bearer）：

| 方法 | /strategy/v1 路径 | 主要输入 |
| --- | --- | --- |
| GET | catalog；lab/inputs | limit、after |
| POST | lab/preview | input_id |
| POST | drafts | name |
| GET/PUT | drafts/:id | PUT: base_version、parameters、input_id可空 |
| POST | drafts/:id/static-check | input_id |
| POST/GET | backtests；backtests/:id | POST: draft_id、input_id |
| POST/GET | releases；releases/:id | POST: backtest_id、allowed_targets |
| POST | releases/:id/approval | content_hash、decision=approve/reject、ttl_seconds仅approve |
| POST | releases/:id/deployments | target=paper/shadow |
| POST | deployments/:id/consume | 空或{} |
| GET | audit | limit、after_sequence |

401无效会话；403capability/自审批；404作用域隐藏；409未验证/未审批/拒绝/CAS；410过期；412hash不匹配；413body；415媒体类型；422格式/目标；429容量；503身份/审计不可用。GET不接收body，未知字段及不适用分页参数拒绝。

实际Supabase身份/持久性/RLS/事务/跨进程恢复、公共BFF和UI、目标部署/安全/性能/持续窗口、同SHA hosted CI均NOT_RUN；继承22组共享义务与本任务4类发布移交。正式用户确认PENDING，按统一规程拟稿，不能自行批准。
