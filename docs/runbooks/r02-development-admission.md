# R02 开发准入复评

本入口执行当前功能要求的完整依赖闭包（F01–F09、TP01-A/B、F0、R01、R02），与组件 `make r02-check` 和正式发布确认分别维护。仅有 COMPLETED、READY 声明或历史报告不能放行。C25 代表性发布性能、C26 已部署 HTTP/JWT、远程候选同 SHA CI 仍由 RELEASE-GATE:BETA 验收；B01/FA-H01 不因此关闭。

1. 配置项目既有 `.env.local` 的 Supabase PostgreSQL/Auth/Storage；不运行本地数据库。保证所需工具已按工程版本安装。
2. 提交全部源码、契约、策略、测试输入，保持干净工作树。实际 target 只创建独立具名 fixture actor，保留不可变事实；actor 清理失败即失败。R02 Research 仅复用当前有效批准下的原1800秒/两标的历史事实，明确 Degraded，不启动行情 ingestion，不扩大用途，批准到期拒绝；当前受控scope必须完整匹配原1800秒窗口回执中的authorization，不能保留scope ID后延长到期时间或扩大权限。
3. 使用从未使用的新子目录执行：

   ```sh
   make r02-assess EVIDENCE_DIR=docs/audit/evidence/provider-a1-remediation-20261004/r02-admission-yyyymmdd/attempt-01
   ```

   完整执行包含既定三次独立可复现构建、跨语言/供应链检查、实际 Supabase 事务/RLS/Auth/恢复链、R01 fixture ingestion 和 R02 保留来源→持久化规则/快照→Python Engine。开发恢复诊断不接受部署性能 SLO。不得降低失败阈值或将 NOT_RUN 记 PASS。失败证据保留；源码修复必须重新提交并在新的证据目录重新执行。
4. 全部检查与源码输入一致后，控制器生成逐节点内容绑定的 DEVELOPMENT manifest，严格验证依赖后发布工程 READY；`formalAccepted=false`，不会设置正式 `review_status=ACCEPTED`。最终文档/回执提交可改变 HEAD；后续源码/规范变化必须重新复评，RELEASE 同 SHA 规则未豁免。
5. 执行 `make r02-admission-check` 并独立 `validateReceipt('CORE:R02')` 校验完整当前内容与嵌套证据。更新审计报告与计划工程摘要后提交；本地提交不自动推送。

正式多角色确认按[统一用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)拟稿并等待项目用户答复，工程 READY 不替代该答复。

远程开发服务启动探针使用最多60秒墙钟预算，必须收到预期HTTP状态且进程仍存活才记READY；超时保持失败。该预算只允许初始化等待，不改行情source-age/readiness、新鲜度、原受控异常提交≤5s或任何发布P95标准。

先执行`make bootstrap`同步`engines/.venv`。集成fixture直接启动其中的Python并持有/回收实际PID，错误路径使用kill_on_drop；不通过uv启动器再间接终止服务。本轮完整复评分配独立8位scope到fixture socket名称，最终独立检查本scope新进程；发现残留即FAIL，清理后仍保留failure，不影响其他scope或既有进程。

只读F06 preflight的精确Connection terminated unexpectedly可按既定最多3次预算重跑完整target，保留所有失败尝试；权限、role、环境配置或业务断言失败不能重试为PASS。Linux进程命令读取使用ps -ww避免截断；平台部署验收仍独立。
