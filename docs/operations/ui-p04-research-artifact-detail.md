# UI-P04 Research / Artifact 高保真详情

范围：I2 UI-P04，`design/P04-Research-and-Artifact-Detail-High-Fidelity-v1.png`、前端设计规格P04与执行计划。复用已确认UI-202/UI-203授权、详情、SSE、取消、产物、证据与审计实现。仅修改页面与呈现层，原runtime/policy/gateway、SSE客户端、BFF/契约、Rust未变。当前功能验收与G2/FEP-2、G1/FEP-1及发布分别记账。

| 设计元素 | 实际落地及边界 |
| --- | --- |
| 导航/顶栏/底栏 | 复用TerminalFrame/TerminalHeader/TerminalNavigation，真实授权workspace/account/mode；不填设计稿示例健康、延迟、通知数或账号 |
| Research左7列 | 规范六状态文案、明确缺失的进度/成本、原始预算/UTC deadline、事件连接与sequence、运行时间线；折叠日志只切换显示，不暂停或伪造流 |
| Research右5列 | 可固定证据面板，真实任务输入/快照/Engine版本/成本/关联/审计，Artifact/Evidence引用；窄屏上下布局 |
| SSE/取消 | 原sequence去重与afterSequence回补；终态只来自授权C03重读，通知不推断结果；202仅受理，未知结果仅原键显式重试，离线/撤权清空两栏 |
| Artifact | 正文与版本哈希双栏、研究Evidence、显式归档JSON预览、已知类型Snapshot→Research→Artifact血缘及C10审计侧栏；未知类型lineageRefs仅文字 |
| 辅助控制 | 面板固定、事件详情展开/折叠、主题切换、当前关联ID复制；复制先检查当前授权，拒绝/不可用反馈明确；未添加新的业务写入 |
| 设计稿缺失字段 | Research标题、模型、classification、原始日志/正文、百分比/elapsed/ETA、引擎健康或质量/许可批准未从当前接口返回，不虚构。实际研究证据缺失明确显示 |
| 策略草稿/导出/缓存 | UI-P04绑定C03/C04/C10，未绑定策略写入或新下载API；Audit既有受控导出独立。未实现加密离线缓存，复用fail-closed清空，不显示过期事实 |

响应式1672/1024/390、深浅主题；原键盘取消对话框保留焦点回返。原生语义标题、命名区域、时间线details、可聚焦滚动JSON文本、跳至正文和完整引用可见。页面字段使用冻结Terminal token与React纯文本，不把归档内容作为HTML、脚本或任意URL执行。

测试范围：呈现层及UI-202/UI-203直接runtime单测（119项），隔离UI-P04 Chromium十四场景，12次axe/12未遮罩截图与12回归基线，类型/lint/单次当前工程构建，门禁/路由直接检查。当前基线由本轮页面采集，随机引用/UTC/动态哈希局部遮罩；用于当前源码防回归，不能当成与设计PNG逐像素相等或独立人工批准。设计映射由Codex查看原图和页面截图；人工读屏、原生200%缩放、跨OS、完整浏览器矩阵仍NOT_RUN。

本机reference种子实际创建，取消使用真实reference；running/cancel_requested/succeeded/failed等状态、重复/缺口事件、Artifact/Evidence成员覆盖及错误注入逐行标记synthetic，不能证明真实worker完成。默认referenceArtifact明确synthetic。沿用reference身份cookie桥、loopback CORS代理及自签TLS，loopback3190/4010与动态reference端口仅为本机替代。无生产凭据，不连接目标数据库、不推送或部署。

保留Firefox BLOCKED_ENVIRONMENT、WebKit附件BLOCKED_ENVIRONMENT_TEST_INTERCEPTION、原6图标/2表头及P03十二条color-contrast incomplete、历史ledger全部NOT_RUN；本页共享导航glyph及可见性产生的新incomplete单独逐扫描保存，不关闭旧项。原UI-P04预检metrics div的aria-prohibited-attr已补group角色，保留原扫描，最终结果按同候选重扫记录。原UI-202/UI-203证据/确认的所有字节和原SHA保持，复用原245Rust输入与e3776999二进制，不重建或全链复验。

当前页面门禁：`node scripts/ui-p04-review.mjs --run <fresh-attempt>` / `--verify`。冻结工程输入后只跑必要当前功能矩阵；同候选输出、日志、基线和原图摘要绑定源码。人工确认PENDING，stage_gate仍NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED；用户确认不能提升未验证状态。下一原任务FRONTEND-GATE:G2按原计划进行范围/缺口核对，不将辅助整改当作FEP-2开发前置。
