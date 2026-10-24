# UI-P23 当前功能复核

任务：I8 UI-P23 Alerts高保真页面与响应交互；依据前端执行计划与P23原设计图。在main仅修改QuantOS，代码/测试/文档/证据及状态同步，不使用生产凭据，不推送或发布。

## 交付与边界

实现筛选/告警流/详情三栏、当前授权账户上下文、仅已加载范围计数/搜索/排序、选择态与原始版本、语义严重程度、可取消的阅读确认dialog与MFA、完整订阅CAS设置、结果未知原请求恢复、显式C10证据链/C11健康预览、独立权限的Portfolio/Audit导航、安全深链复制、有限SSE状态。宽屏1672/1440、1024重排、390堆叠与折叠筛选，dark/light双主题。

ack不等于resolved，原因/二次验证/版本复核/CAS/回执与来源保持；无批量写、无离线写。C10范围、分页和唯一性，C11账户/模式/30秒有效期分别验证，不把健康当作本告警来源证明。处置导航只读，不调用runbook/incident/交易动作；C16没有关联对象ID，不虚构RiskDecision、incident或订单。UI-601后续交付完整Operations。

设计映射和全部契约偏差见[规程](../operations/ui-p23-alerts-high-fidelity.md)。批量已读、Venue/时间过滤、影响金额/阈值、桌面通知渠道与持续实时状态均未由当前契约提供，不以示意图替代事实。旧C02告警objectRef契约未重写。六事件样本明确SYNTHETIC_C16_PRESENTATION_ONLY、providerAcceptance=false，真实数据画面与样本分别标记。

## 验证范围

新增presentation/C10/C11策略测试；当前UI603 35项、实际C01/F06/C10/C11/C16消费者、既有C16/P18/导航直接回归；Rust仅operations模块；类型、lint、一次冻结候选构建、静态路由/阶段政策、计划检查。新Chromium7项加当前UI603适配后的6项直接回归；8组主题/宽度axe和几何、8张主页面+2张移动详情+确认弹窗+明确合成样本截图。原始命令/数量/SHA/产物以[证据](./evidence/ui-p23-local-20261024/README.md)receipt/result为准。

preflight首轮unit1个fixture权限集合遗漏，已修正；类型排序表达式括号语法、lint中structuredClone全局声明错误已修正。首轮7个浏览器通过后人工看图发现dialog未居中、附加dark截图实际light；已修复与补断言，原截图保留。严重程度span无role带来aria-prohibited-attr incomplete，已修复role=img；订阅取消草稿不再影响重开时的服务端集合。未冻结preflight不作源码绑定验收；未捕获的终端输出不伪称已有日志。

## Gate及未决事项

工程Gate目标PASS_UI_P23_ALERTS_HIGH_FIDELITY，开发IMPLEMENTED_PENDING_ACCEPTANCE；正式stage_gate保持NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED，不自行批准ACCEPTED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL不变；UI402-MARKER-SOURCE-01同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED。UI603/G4/FEP4历史包逐字节保留为ORIGINAL_SCOPE_ONLY，不重绑新候选。

真实IdP/cookie/CORS、目标DB/RLS/事务、外部告警源、远程同SHA CI、Firefox/WebKit、完整I8联调、性能容量/长稳、人工读屏/原生200%缩放、RELEASE NOT_RUN。实际本机Rust reference+受控X06/F09；身份cookie桥接和回环TLS/CORS代理为替代，故障注入单独标记。axe incomplete原样保留，不提升为完整无障碍验收。

下一原开发任务FE:UI-601（Operations/Incident/Runbook）；不以G4未决缺口作为其新开发前置。回退通过本地源码提交有审阅git revert并重建terminal；无DB迁移、外部写入或事实清理，原证据保留。

## 冻结结论

源码7cdb23b46f1af6b790db480209f626a1fde15867，attempt-01：PASS_UI_P23_ALERTS_HIGH_FIDELITY。85项前端/消费者、21项Rust operations、62项Node通过；Chromium新增7项加UI603直接回归6项全部通过，无skip/重试/flaky；类型/lint/构建/计划通过。8组主题/宽度几何与axe零violation，保留8项color-contrast incomplete；原span role问题已修复。

已人工查看本次居中dark确认弹窗、明确合成dark六事件和light390详情下部，复核前期实际dark1672/light390截图的布局；实际module截图与合成样本分别标记，不将文件名、mock数值、有限stream或样本截图等同目标/提供方验收。

217个历史证据文件逐字节未变，原G4/FEP4缺口与159项NOT_ASSESSED不变。INTEGRATION预期拒绝，FE:UI-601开发允许。正式formalAccepted=false、runtimeAdmission=DENIED；仅本地源码和证据提交，未使用生产凭据，未推送或发布。
