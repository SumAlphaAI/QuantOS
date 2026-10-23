# UI-203 原稿确认记录（2026-10-23）

项目用户在本会话确认 UI-203 原完整稿。记录时间 2026-10-23T02:49:50Z；唯一确认人为 ProjectUser，Codex 核对、记录并执行门禁，不代用户批准。

工程仅绑定 `03ecbdfa31d075a821cabe6e278c65131e25cde9`，原稿及证据包绑定 `764057acb29a313f71851f02795e34a397fdc307`。输入摘要 `sha256:15e2094271d2b434f738378db72e9d2c0a100fea84eee970df1be377653ef182`。

- [原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[记录摘要](./approval.json)。
- [原完整稿](../ui203-local-20261023/confirmation-draft.md)、[原范围](../ui203-local-20261023/scope.json)、[工程回执](../ui203-local-20261023/receipt.json)、[原清单](../ui203-local-20261023/manifest.json)。
- [确认门禁](../../../../scripts/ui203-confirmed-reference.mjs)、[拒绝测试](../../../../scripts/ui203-confirmed-reference.test.mjs)。

仅将 UI-203 development_status 同步为 COMPLETED，含义为原稿当前功能已确认；原稿、报告、scope/receipt 中 PENDING 是历史事实，不改写。159 项 stage_gate 仍为 NOT_ASSESSED，G1/FEP-1 仍为 NOT_READY_GAPS_OPEN。INTEGRATION 预期拒绝 STAGE_NOT_READY；formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。确认不授予业务、策略、交易用途许可。

只读核对原593输入、139个清单摘要、119个原证据文件、46产物及10条命令。原76单测、12 Chromium、67门禁/路由、4截图/4次axe及types/lint/build仍绑定03ecbdfa，不重跑功能、构建、浏览器、Rust、数据库或全链。245 Rust 输入未变，e3776999 reference二进制仍按原范围复用。所有预检失败与原始扫描保留。

保留 reference身份cookie桥/CORS loopback/自签TLS替代、Firefox环境阻塞和WebKit附件拦截接收阻塞，历史ledger全部NOT_RUN。原6项图标、2项表头及UI-P03的12条color-contrast incomplete保留原SHA、哈希、主题/路由/宽度和节点数；跨扫描重复控件不等于独立缺陷数。UI-202与UI-203各4次零违规、零新增incomplete扫描均按原候选保留，不关闭历史扫描记录。UI-203预检4条aria-prohibited-attr incomplete及修正后的最终扫描保留，不改记为对比度问题。

父Research种子实际由reference创建，但Artifact/Evidence成员与摘要关系为标记合成覆盖，不代表真实worker/引擎完成；C10分页保留浏览器合成游标与剔除后上游重读边界，不代表真实签名游标验收。预置Artifact明确synthetic；inputHash缺失显示缺失。归档JSON按owner返回的hash绑定，未独立重算canonical bytes或密码学验签。浏览器业务GET-only，Node控制种子POST与服务端读取审计事实分别记录。恢复仅重读元数据，不重放预览或写入。

真实IdP/MFA/Cookie/CORS、目标数据库/Storage、provider/实际引擎产物、生产host、远程同SHA CI、人工读屏、原生200%缩放、跨OS、性能/长稳及发布均保留NOT_RUN。UI-P04高保真基线比较属于下一独立任务。

下一原任务 **I2 UI-P04：P04-Research-and-Artifact-Detail-High-Fidelity-v1.png** 开发允许，无G1辅助项前置。本轮未使用生产凭据、推送或部署。

确认门禁预检保留：[定位错误诊断](./preflight-gate.json)、[文档链接未齐时门禁失败](./proof-write.log)、[同期112/113测试记录](./confirmation-tests-preflight.log)。前者修正新脚本任务锚点，后者补齐本记录链接；未改原证据以规避校验。最终结果见 [checks.json](./checks.json) 和 [closure-proof.json](./closure-proof.json)。

最终7项检查均得到预期退出码，113/113项确认及拒绝测试通过；同SHA原功能结果只读核对，没有重新执行。实际时间与日志摘要见checks.json。

| 命令 | 结果 |
| --- | --- |
| `node scripts/ui203-confirmed-reference.mjs --write` | 0，生成确认闭合证明 |
| `node --test scripts/ui203-confirmed-reference.test.mjs scripts/user-acceptance-confirmation.test.mjs` | 0，113/113 |
| 固定pnpm10.20.0 `exec eslint scripts/ui203-confirmed-reference.mjs scripts/ui203-confirmed-reference.test.mjs` | 0 |
| `node scripts/check-development-plans.mjs` | 0，159阶段仍NOT_ASSESSED |
| `node scripts/development-execution.mjs --integration FE:UI-203` | 1，预期拒绝STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-P04` | 0，开发允许 |
| `node scripts/ui203-confirmed-reference.mjs` | 0，确认闭合证明一致 |

固定包管理器实际路径 `/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin/pnpm`；未安装依赖。当前确认工具独立验证COMPLETED及不可变证据，未放宽原工程工具中IMPLEMENTED_PENDING_ACCEPTANCE校验，也未把原PENDING改为新候选通过。
