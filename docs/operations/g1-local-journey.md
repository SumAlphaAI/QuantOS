# G1-REC-02 本机组合验证规程

本入口验证同一工程候选的实际登录页/PKCE回调、Command、P15资料/通知/安全、P17历史与下载、C10审计查询和恢复一致性。冻结源码与测试输入后，运行 `node scripts/g1-journey-review.mjs --run docs/audit/evidence/g1-journey-local-20261022/attempt-NN`，每次使用新目录；核验用 `--verify`。只使用白名单公开环境、锁定pnpm与离线Cargo。3190为静态前端，4010为临时测试证书HTTPS桥，Rust reference使用随机环回端口。系统禁止建立本地数据库，亦不调用目标数据库/IdP/Storage。

明确替代边界：reference没有真实`/v1/auth/session`或OIDC issuer，测试桥提供一次性code/S256校验与session建立fixture，随后注入reference cookie身份。该替身只能验证实际前端流程，不能验证真实IdP、Cookie/SameSite/CORS或持久会话；真实值均NOT_RUN。导出创建尚无本任务可用UI，使用明确NODE_CONTROL_PORT调用实际MFA/reauth/createExport，202之后由P17实际页面读取history并显式申请/下载内容。桥不改reference响应字节、下载URL或签名；实际浏览器原附件必须匹配下载响应hash，审计payload按规范hash复核，不保存原用户输入/秘密/租约URL。TLS信任例外仅限生成的环回测试证书。

每案独立reference进程，同一冻结二进制和前端buildId；不得以多个源码候选的零散PASS拼接当前旅程。必须保留CAS真实409、明确rebase/再保存、commit后响应丢失与同intent幂等再试、DELETE未知结果的事实重读、202受理保留记录直到显式重读、实际MFA 429以及明确标记的短429前端恢复、reference401/403、断流/离线/跨页面新读及不重放写入。短429是合成故障；真实MFA60秒冷却到期不由短429替代。错误state只验证实际前端拒绝，不声称真实IdP防重放。

本轮发现reference旧settings审计仅有action/auditRef，C10按eventId过滤后不可查询；整改为现有结构化格式并保留action别名和内部计数。保存响应correlation与可查询事件关联，安全202的auditRef须解析为唯一eventId；幂等重放不追加审计/不重复变更，未知结果绝不被“取消”解释为回滚。settings响应的schema未变，重放响应可能分配新HTTP correlation，事实关联依原意图/原成功事件与版本，不把该重放HTTP ID误作新业务审计。

只允许给出`PASS_LOCAL_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS`。旧确认仍绑定旧稿/SHA，原PENDING与全部NOT_RUN/失败记录不改。G1/FEP-1维持NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；P15独立确认、依赖适用性、Firefox/WebKit、目标义务与发布矩阵继续保留。确认稿须覆盖六维度并由项目用户另行确认。测试通过不自动授I2准入，无推送/部署。
