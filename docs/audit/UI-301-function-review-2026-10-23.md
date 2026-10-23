# UI-301 当前功能实现与验证

依据：[UI-301](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-ui-301)。交付范围、接口与恢复规则见[操作规程](../operations/ui301-strategy-drafts.md)。源码及验证均直接在 main，未使用生产凭据、未连接数据库、未推送或部署。

## 实现

交付 Strategy 目录、排序/分页、UUID Lab 深链、文件/参数 JSON 编辑、32768 UTF-8 字节校验、带 objectVersion 的单请求自动保存。读 C01/C05 均 no-store；每次保存重新核对身份、范围、有效期和 strategy.write。409 保留本地草稿，读取真实服务端 head 并显示基础/本地/服务端逐字段 diff；合并和后续保存必须显式操作。未知结果锁定编辑，原键/原体/原版本重试；在途新编辑不被晚回执丢弃。权限失效/离线清除内存，恢复不重放。

C05 当前没有浏览器创建策略接口，`/strategies/new` 提供服务端注册说明。保存草稿不证明可运行；受信规则源的静态检查、回测及 Release 属于后续 UI-302/UI-303。UI-P06 高保真验收不在本任务中提前认定完成。

## 验证与 Gate

最终结果以[限定证据 receipt](evidence/ui301-local-20261023/receipt.json)及[索引](evidence/ui301-local-20261023/README.md)为准。来源 SHA 固定在 receipt.sourceCommit；提交证据之后不改绑为新 HEAD PASS。执行脚本保存命令、开始/结束时间、退出码、信号、日志、输入与产物哈希；失败尝试永久保留。

验证范围：当前状态机/契约及 DraftBuffer 回归；C05 并发冲突和丢失响应幂等服务用例；重新构建 reference BFF；Terminal 类型、lint、一轮构建与 client-secret 检查；静态路由/主机与门禁拒绝测试；Chromium 实际页面成功、409、未知结果、拒绝、权限恢复、深链和双主题/移动布局。扩大到两个 C05 服务用例和共享路由回归的原因是验证真实版本/幂等语义及新增 Lab 静态路由，未执行全仓或递归上游闭包。

浏览器业务响应为实际本机 reference C05。身份 cookie 桥接、TLS/CORS 代理为替代；422 为标记的合成故障，只读路径使用真实 reference 审批者身份。真实 IdP/MFA/CORS、Supabase/RLS/事务、目标 Storage、托管平台 rewrite、Firefox/WebKit、远程同 SHA CI、性能/容量/长稳、读屏/native 200% 及完整 I3/FEP-3/发布验收均 `NOT_RUN`。

`development_status=IMPLEMENTED_PENDING_ACCEPTANCE`；工程功能 Gate 由最终 receipt 判定；`stage_gate=INTEGRATION/NOT_ASSESSED`、`confirmation=PENDING`、`formalAccepted=false`、`runtimeAdmission=DENIED`。没有以本任务实现或证据提交替代用户确认。下一原计划任务为 **UI-P06 Strategy Catalog/Lab 高保真页面交付**。
