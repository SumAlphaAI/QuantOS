# PROVIDER:A1 功能验收规程

依据执行计划第 2.1 节，在 DEVELOPMENT 对当前实现与依赖闭包生成内容绑定回执，发布性能、长稳、staging、同 SHA 托管 CI 和联合签署由 RELEASE 收口。

`pnpm assess:provider-a1` 从干净源码提交执行 `scripts/provider-a1-policy.json` 的全部必需命令，记录日志、环境、输入清单、依赖清单、范围和遗留项；当前检查点闭包共 14 节点。独立命令继续记录执行结果，任何失败都阻止 READY。实际数据库检查只读取 `.env.local` 的既有 Supabase 配置；Web 构建使用受控 `env/local-mock.env.example` 公开变量与 3190 callback 覆盖，不写入本地环境文件。F05 只做八项数据/租约/幂等恢复功能检查，F06 使用既有目标入口，不执行 provision、migration/reset 或本地数据库。F06 在写入本轮审计日志之前运行，以满足其干净源码要求。

所有执行通过后自底向上写入 stage_gate：manifest 全文 SHA-256 作为 input_digest，evidence 指向本节点 manifest。只有这次经内容与结果校验的节点获得 READY；不迁移历史正式 ACCEPTED 或 notes。`observedSourceCommit` 表示执行时源码提交。其后文档和 stage_gate 更新不改变受检代码；输入摘要与规范要求投影会验证代码/契约/配置/测试和依赖回执是否仍适用，而不是伪造最终文档提交的同 SHA formal receipt。

`pnpm check:provider-a1` 不访问数据库，只核验当前文件内容、精确输入清单、实际命令与结果、日志摘要、F06 目标原始压缩日志、依赖 READY 和规范要求。任意文档、格式正确的假摘要或静态计划 PASS 不能替代功能回执。`pnpm test:provider-a1` 检查篡改、少跑、失败、依赖未就绪、路径逃逸和将本地 PASS 冒充数据库执行等拒绝场景，CI 执行这两个入口。

输入路径由版本化策略声明并精确枚举，含 code/contract/config/test 角色。规范要求来自计划相应任务的需求/验收条目和检查点 required_scope；生命周期字段不参与摘要，避免回执递归绑定自身。代码、配置、规范或验证器改变时按受影响范围重新评估，不能删除必要检查、手工填写 PASS 或用新摘要遮蔽失败。

数据库未执行不得记 PASS。默认 Cargo 忽略 real_logout_db_write_matches_persistent_trace；正式 F09 runner 显式选择 --ignored 且要求目标 opt-in。A1 的独立状态探针仅确认未授权显式运行会失败，不执行该数据库 case。

原始报告与失败证据保留在 docs/audit/PROVIDER-A1-comprehensive-review-2026-10-04.md；整改状态另行登记。整个回执只授权功能前置，不授权正式发布或 staged 部署。

执行开始前与结束后核对输入清单、规范要求和源码提交；期间输入发生变化即拒绝回执。远程 F06 DEVELOPMENT HTTP 探针显式采用 60 秒传输等待上限，允许值限定 15–60 秒且记录实际耗时；默认独立探针仍为 15 秒。等待上限不构成性能/P95 验收，正式延迟要求由 RELEASE 单独评估。

只有明确的 Auth/BFF 会话 503 或传输超时可触发至多三次完整 F06 重跑，所有失败日志保留；权限/资源/安全断言失败不自动重试。目标 PASS 必须来自某一次完整七步执行，不能拼接不同尝试的通过步骤。此策略不证明 RELEASE 的可用性或稳定性目标。
