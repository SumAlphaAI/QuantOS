# CORE:X06 DEVELOPMENT / L4-NATIVE-CONTROL-01

公共全局/账户 kill → 当前 X02 generation → 原生持久停止 → 共同 C10，在 owned 本机执行域接续。P11 `/orders` 提供当前状态、显式 MFA 停止、独立解除复核和 Owner 解除；单次停止/解除都会使旧签名 RiskDecision/Subject 永久失效，解除不生成新的 Proposal 或风险决定。

## 权限与请求

- `GET /v1/risk/kill-switch`：认证当前域、状态及有界历史，8 秒以内 freshness；所有回执 `executionAuthority=false`。
- `POST /v1/risk/kill-switch/engage`：账户 Operator/Owner、全局 Owner。`scope=account|global`，账户必须匹配当前 C01，global 的 accountId=null。
- `POST /v1/risk/kill-switch/release-approvals`：Approver/Owner 独立复核；不改变 generation 或停止状态。
- `POST /v1/risk/kill-switch/release`：不同用户 Owner 消费当前范围/当前 generation/原期限内复核票据；显式 MFA 确认。另一层停止或永久紧急停止仍生效。

所有写入严格验证 Origin/CSRF、角色、账户、`expectedGeneration` canonical u64 字符串、原因、精确确认短语、已验证且未消费的原 session `security_change` MFA/reauth，期限取 session/challenge/grant/verified+120s 的最小值。generation CAS 冲突拒绝；同 actor/key/body 仅在原期限内返回原不可变事件，不能作为当前状态，客户端随后 GET。换 body 返回409，换 key 重用 proof 返回403。每份复核只被一次显式解除消费，不自动解除。日志4096上限、活动复核100上限及历史100截断均拒绝或显式标记，不删除业务事实。

确认短语：`ENGAGE ACCOUNT KILL` / `ENGAGE GLOBAL KILL`；`APPROVE ACCOUNT RELEASE` / `APPROVE GLOBAL RELEASE`；`RELEASE ACCOUNT KILL` / `RELEASE GLOBAL KILL`。

## 落盘、恢复与 UNKNOWN

所有配合的 BFF 副本使用既有稳定审批 OS 锁。ControlRecord hash 链、当前 X02 签名状态、proof 消费和审计来源同一认证 `approvals` 事务 fsync 提交，然后同步 native `commands` 持久停止，成功后才能返回。每次请求先认证重载，验证原生保护锚点和审批绑定，再同步已提交控制；提交后回执丢失或 BFF 进程死亡不会产生新决定。此恢复仅应用已授权决定，不自动生成 release。

命令在另一个认证文件预留且可能先于 BFF 死亡落盘，因此恢复允许绑定已有审批的认证新增预留；原锚点保护的每条预留/claim 均须逐项原样保留。旧原生 generation、同 generation 分叉、永久停止回退、缺失/篡改/不一致日志一律拒绝；已初始化 owner 文件缺失也会拒绝启动。该机制仅单机与配合进程，不能抵抗同时回滚全部文件/密钥/宿主的管理员；没有外部单调锚点或分布式原子承诺。

控制只修改 stop/generation。native 已预留命令、UNKNOWN 签名/期限/事实、X01 隔离、X05/X06 OPEN Alert 均保持；无补发、自动关闭、费用归零或日结授权。公共 C10 新增 `assisted.kill_engage` / `assisted.kill_approve_release` / `assisted.kill_release`，关联停止 correlation；旧请求事件前缀不重写。

Terminal 钉住原身份及最小 session 期限，MFA 前后重读当前状态，原 key/body/CSRF/期限只允许手工恢复；本机小屏/离线拒绝保留未知意图，真实撤权/身份切换清除敏感状态。跨页面未知意图不持久重放，重新进入需先 GET 当前事实。

## 验收边界与移交

[范围](../execution/core-x06-native-control-scope.json)保留19 gap/8义务 OPEN。全局仅指当前 tenant/workspace 已配置执行域，当前 profile 一个账户；未证明所有部署账户/进程传播、目标时延或在途 venue 撤单。实际 IdP、目标 Supabase/RLS/Vault、真实 venue/testnet、跨主机、完整账户 books/估值、外部通知/明确关闭、安全容量长稳/同 SHA CI/发布 NOT_RUN。

工程 Gate 目标 `PASS_CURRENT_PUBLIC_KILL_X02_NATIVE_DURABLE_STOP_C10`；完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=DENIED，M5 `PREPARED_NOT_READY`。正式文稿仅待确认，不自签准入。[冻结原始证据](../audit/evidence/core-x06-native-control-local-20261029/README.md)另行绑定源 SHA。旧 L4 的公共 kill 403 结果保持原 SHA 原范围，不修改历史材料。

仅执行当前功能与持久中间件/P11/C10的直接回归，不递归重验全部上游或 F05/F07。owned 故障钩子只读取私有临时 owner 目录 `pause-control-after-commit` 文件，由测试进程在提交后实际杀死 BFF；没有公开故障注入 HTTP 接口或生产启动路径。

下一任务 `CORE:X06 DEVELOPMENT / L4-C11-ACTIVATION-01`：把 scoped/versioned C11 activation/history 接实际运行时条件，验证权限、时效、恢复和拒绝，继续保留原控制代次和 UNKNOWN。
