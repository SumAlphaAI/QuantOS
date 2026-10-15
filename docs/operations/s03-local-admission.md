# S03 本地开发准入

S03_LOCAL 只发布 CORE:S03 的 DEVELOPMENT READY。保留直接依赖 CORE:S02、CORE:F06、CORE-GATE:R1-SERVICE，展开35个必要节点；新冻结候选完整重跑115组，111组依赖检查先于自身4组，公共 make test 同时覆盖工程代码。不拼接旧 S02/F06/R1 回执，不授予上游独立READY；S02旧准入随共享功能输入变化撤回，原件保留。

预检 `QUANTOS_SKIP_ENV=1 make s03-check`。提交并冻结全部功能输入后，`QUANTOS_SKIP_ENV=1 make s03-assess-local`；失败必须使用全新 attempt-NN，不能重用旧通过组。记录器清除数据库/密钥/外部测试开关，离线解析依赖，不执行外部业务或发布；真实 UDS/本机服务需要正常 IPC 权限。包管理器可能验证公开元数据，不代表生产连接。三次独立构建、make lint/test、完整依赖和专用检查都绑定同一候选。

S03 专项6项覆盖：目标枚举拒绝Assisted Live；100次未验证/未审批拒绝；去重/冲突；租户/工作区/capability/时效/审批hash与内容篡改；20路并发审批只有1成功、20路票据幂等；实际自有Python进程→S01版本→S02回测→S03审批→Paper/Shadow原生adapter实际重放（报告完全一致）及拒绝后恢复。原始日志保存完整实际 Release、审批与嵌入回测 JSON，校验候选和全部关键绑定。专项是本地受控配置消费，不是外部部署。89项准入测试验证缺依赖、混候选、跳过、篡改、非法目标/正式声明和事务性发布回滚。迁移6项静态契约检查仅证明文本合同；显式 ignored 的 PostgreSQL 持久层测试及历史NULL workspace的真实Row只读回归均未运行；须另行授权目标，写入测试还需专用测试用户。

记录器先备份 canonical 组件输出，在成功/失败后恢复原有字节和目录存在性，把本轮生成内容留在 attempt。只在完整闭包通过后事务性发布 S03 manifest 与两份计划；失败回滚。`make s03-local-check` 重核当前输入，`make s03-release-check` 对缺真实发布/正式验收回执应拒绝。

可信宿主提供 AuthContext、时钟、源码与制品来源；不得把 HTTP 用户输入直接传作这些参数。进程内目录及票据重启不持久；实际 Supabase、外部来源授权、部署安全/回滚、负载/性能/长稳、同SHA hosted CI与项目用户正式确认仍NOT_RUN/PENDING，由测试及RELEASE-GATE:BETA首次发布前实际验收。遵循统一项目用户确认规程，不能自行批准正式ACCEPTED。
