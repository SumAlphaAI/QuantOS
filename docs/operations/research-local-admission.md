# A2、R1 与 BFF-FE-003 本地功能准入

三个消费者使用独立的 A2_LOCAL（17 节点）、R1_LOCAL（27 节点）和 BFF003_LOCAL（40 节点）profile。完整闭包由当前执行计划计算；共同检查只执行一次，子索引从同一源码、同次实际执行派生，再分别递归验证。上游组件仅作为消费者限定的 LOCAL_READY 投影，不登记上游独立 READY。

`make research-local-assess ATTEMPT=docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-NN` 要求干净 Git 和全新目录。冻结代码后执行全部必要功能检查、R04 的 100 条不可执行 Proposal/22 类伪造引用拒绝/零订单、A2 的 26 个真实回环 HTTP operation 和 8+5 个语义变异，以及 BFF003 的 9 个 provider 响应、schema/client 与权限/幂等/取消回归。临时 Engine 限定随机所有权标签，最后检查进程清理。原历史组件证据在执行期间备份并恢复；新原件、日志和产物存入新 attempt，失败不拼接为成功。

`make research-local-check` 验证三个已发布本地回执并运行负向测试；`make r1-local-check`、`make a2-local-check`、`make bff003-local-check` 可分别复核。修改任何绑定的代码、测试、配置或规范范围后，须撤回受影响准入并重跑闭包。文档 Gate 状态和报告不进入功能输入摘要，避免自引用。

运行环境删除 DATABASE_URL、Supabase、令牌/密码/密钥及数据库测试开关，设置 QUANTOS_SKIP_ENV；Cargo、uv、npm 使用离线模式。回环参考 provider 和合成 Engine 是真实模块执行，使用内存边界，不运行数据库或 Docker，不使用生产凭据。

开发准入不要求外部环境或性能达标。以下全部保持 RELEASE NOT_RUN：配置 Supabase 的迁移/RLS/事务/Auth/Storage、身份/audit/Research 持久闭环、独立 worker 恢复和取消、真实数据来源与用途许可、外部 Engine/部署及隔离、远程漏洞库 SCA/fork 治理、代表性性能/容量/长稳、完整浏览器矩阵及候选同 SHA CI。原阈值保留；`make r01-release-performance` 与 `make frontend-release-performance` 是严格性能入口，CI bundle 仅输出开发诊断。测试 timeout 只限制验证工具执行，不代表产品性能验收。

旧严格入口继续保留：`pnpm check:provider-a2:target`、现有 BFF001/BFF007 live runner、R03/R04 release runner、`scripts/test-bff-fe-003-live.mjs`。严格目标检查不得由本地 profile 冒充。外部目标检查只在发布阶段、具备相应环境和授权时执行。

原始 BFF003 manifest 保留，可用 `node scripts/bff-fe-003-development.mjs --historical` 查看；当前准入用默认或 `--ready`。正式验收遵循 [项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)，本地 READY 的 formalAccepted 始终 false；本任务不 push、不部署、不发布。
