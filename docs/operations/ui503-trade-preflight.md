# UI-503 Trade Ticket preflight

`/trade`选择C07当前授权前50条建议，或从P09的`/trade?proposalId=UUID`深链独立读取；拒绝重复/未知查询、无效UUID及account/mode/quantity注入。无需新增泛化静态fallback。仅Paper/Shadow读取，C01需execution.operate及market.read，持续route-access重验；URL/浏览器草稿不构成权限。

三个步骤：读取并核查 → 重新核查并继续 → 重新核查并预填intent。每次均重读C01 session/context、C07 Proposal、C13 order-capabilities与opt-in当前上下文、C12 catalog及精确symbol/venue/product报价、C13密集状态流，再重读Proposal/C13/capabilities/C01核对稳定性。报价/余额/限额/健康/版本/mode不是沿用上一步的准入事实；发生变化回到审阅，不自动推进。

C13 OpenAPI 1.15新增可选`includeTicketContext="true"|"false"` GET查询及可选TradeTicketContext。显式字符串enum符合现有查询校验器，不扩大共享解析器；默认/false保持原响应，不破坏旧UI502/P09严格消费者。投影只来自绑定服务端Proposal.intent、AccountFinancials、VenueState、RiskPolicy/RiskInput；返回quantity/limitPrice、权益余额与时间、venue健康与观察时间、政策版本/修订及inputHash。不返回command_key、actor、签名、命令引用或私有source_ref；opt-in不增加任何操作权限。SSE保留原基础preflight协议，界面检查密集sequence、streamId、当前资源/mode、correlation，拒绝丢帧/换租约/撤权。

**可用现金来源缺口**：AccountFinancials只有equity、daily PnL及账本asOf，没有available cash。ticketContext.availableCash固定null，展示“权益余额（非可用现金）”及“资金可用性未核验”；availableCashChecked=false、submissionReady=false始终成立。不能把权益推导成可用现金，也不能宣称资金充足或实际下单准入。补齐真实现金源与目标资金校验属于未完成的联调/发布义务。

C12市场数据是独立参考：严格选择一个instrument，歧义要求显式选venue；绑定schema/provenance/授权引用/币种标的/质量，2秒报价时效，拒绝degraded/未来/跨venue/伪executable。其USD/USDT或venue与执行OWNED_PAPER不同，不能混用。intent限价来自服务端原Proposal intent，不用市场报价或notional除法伪造。C13预检、限额/健康/财务每步重新读取；财务/venue≤60秒且无未来时间，预检/Proposal/Signal必须未过期，核验窗口8秒。Decimal用字符串/BigInt校验数量/价格精度、最大数量/最大名义值及数量×限价一致性。

仅生成内存草稿`{proposalId,objectVersion,accountId,mode,symbol,action,quantity,limitPrice,executable:false}`；不构造hash/decision/approval/command/签名、不POST、不提交venue。allow/approval_required仅原建议预检，不表示浏览器新意图已获评估。来源变化退回第1步重新审阅；deny/健康差/超限/过期/错误无草稿。每步busy同步锁；429有界冷却，无自动重试。读取失败保留获准旧快照并标未核验；关闭/离线/隐藏/失焦/撤权/会话变化清空事实与草稿，中断迟到响应；恢复仅重新读取，不重放写入。引用/草稿无localStorage/sessionStorage持久化。

`node scripts/ui503-review.mjs --run <新attempt>`对冻结源码执行当前单元/真实C07/C12/C13消费者、UI502/P09/执行恢复/C01/导航直接影响回归、生成契约/响应/请求回归、C13/执行宿主、typecheck/ESLint/rustfmt/静态构建、Chromium成功/拒绝/恢复及基本明暗桌面移动axe。`--verify`复核输入/命令/日志/二进制/构建/网络/截图hash。无需递归上游/全仓/数据库campaign。消费者与浏览器使用真实reference BFF，合成身份/数据、TLS/CORS桥及每个负面探针明确标注；只有显式Owner Kill/MFA与logout测试控制允许POST，Trade Ticket交互全部GET。

IMPLEMENTED_PENDING_ACCEPTANCE；有界工程Gate不提升INTEGRATION/I5/RELEASE，formalAccepted=false、runtimeAdmission=DENIED。真实IdP/cookie/CORS、目标Supabase/RLS/事务、真实可用现金/实时组合/venue/行情对齐、长期SSE/持久恢复、多浏览器/跨OS、人工读屏/native200%、同SHA远程CI、性能容量长稳与完整I5/RELEASE均NOT_RUN。禁止生产凭据、推送或部署。下一原任务FE:UI-504 Approval/MFA/职责分离，不能把此intent草稿直接当Command。
