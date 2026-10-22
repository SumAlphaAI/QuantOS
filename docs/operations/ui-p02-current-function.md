# UI-P02 Command Center 当前页面范围

依据 `design/P02-Command-Center-High-Fidelity-v1.png` 与前端计划 UI-P02，交付 `/command`。C01 session/context 顺序守卫通过后，只读取当前受权账户的 C02 `/v1/command/summary`；C06 执行/风险及 C16 运维/告警事实由 C02 聚合，不由前端拼接业务结论。

卡片、列表、导航按实际 `research.read`、`execution.operate`、`ops.read`、`strategy.write/approve` 裁剪，同时屏蔽 forbidden/unready 来源的明细。未知字段保留 null/—，真实0保持0；无页面内的2/18/4/3等示例兜底。原 mock 只在显式 local-mock 下提供 C02形状 fixture，并始终显示 Mocked 标识，真实构建不回退 fixture。

C02 未提供 Actor、审计 correlation ID、服务延迟或可用率，页面不从对象ID或Ready状态推测。系统健康用实际 systemHealth 与逐源状态/时间；数据年龄为 sampledAt-asOf，明确标为“采样时数据年龄”，不代表网络延迟。对象链接必须严格匹配 kind/id/站内路径；跨mode订单、错误来源状态/指标、过期、未来或已过源时效的Ready元数据均拒绝。C02租约不得超过sampledAt+30秒及各Ready来源的有效期（execution60秒、其他30秒）；mounted投影按session/context/summary最早期限清除并重验；权限在刷新、到期、网络恢复时重新核验，未声明实时撤权推送。

当前页面只读，HTTP快照有手动与租约到期刷新；未开启SSE，底栏明确“未订阅实时流”。网络断开保留有效期内内存只读缓存、禁用资源入口，不重放旧写意图。优先级筛选、最多50项列表展开、键盘访问、布局折叠/紧凑与恢复默认可用；localStorage只存两个布局布尔值，失败时保留会话内交互，不保存身份、token或业务事实。全局搜索/通知数契约未提供时明确禁用；研究/策略创建保留原只读边界，实际创建流程由后续任务交付。资源导航目标页仍须独立鉴权。

深浅主题由系统媒体偏好控制，保持冻结语义token；1440/1024/390及CSS zoom=2验证范围与原生200%缩放分开。英文完整文案、跨OS视觉与完整目标业务链另行验收。

验证入口：`node scripts/ui-p02-review.mjs --run docs/audit/evidence/ui-p02-local-20261022/function-attempt-NN`。先提交工程；只运行当前页面/来源校验、守卫、直接共享Chrome消费者和C02真实本机组合，以及必要types/lint/build与视觉。公开环境配置过滤生产变量；Rust reference模块使用种子测试身份/来源。浏览器实际Rust组合通过测试身份/CORS桥接，原响应体保持不变，不代替真实IdP、浏览器Cookie/CORS、目标数据库或生产后端验收。完整命令、原始日志/附件与输入SHA绑定。Firefox独立启动诊断；环境失败不记功能PASS。

当前页面工程/客户端契约与受控本机组合分别记账。直接前提只保留原范围引用，不递归复验或重新授予READY；INTEGRATION NOT_ASSESSED，确认PENDING，formalAccepted=false，runtimeAdmission=DENIED。真实IdP/MFA、目标BFF/数据库、浏览器真实Cookie/CORS、人工读屏、原生200%、跨平台基线、远程同SHA CI、性能/长稳及RELEASE均NOT_RUN。新P02基线初始化不是独立设计验收，旧确认稿与原始审计证据保持。
