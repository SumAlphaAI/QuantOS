# UI-P23 本机验收证据（2026-10-24）

运行 `node scripts/ui-p23-review.mjs --verify`；源码候选、精确命令/结果和产物摘要以receipt/result为准。preflight为未冻结工作树检查，不作版本绑定验收；保留全部已记录失败与修复前截图。正式结论须由后续完整冻结attempt确认。

当前首轮unit.log保留1个fixture权限集合缺execution.operate导致的断言失败；unit-2.log为修正后的检查。初次类型检查发现presentation排序括号语法错误，终端输出未保存，不宣称有其版本绑定原日志；已修正。其他结果依原日志记录，不覆盖旧失败。

证据范围：真实Rust reference C01/C10/C11/C16消费者与受控X06/F09；cookie身份桥接/TLS CORS代理为替代。六条混合事件图为明确SYNTHETIC_C16_PRESENTATION_ONLY，不代表提供方真实多事件、业务处置或外部告警验收。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL与原未决缺口保持；旧UI603/G4/FEP4证据只作ORIGINAL_SCOPE_ONLY，不修改或重绑。

preflight浏览器7/7功能检查通过后，人工查看发现确认弹窗受全局reset影响停在左上角，以及两个名为dark的附加截图实际采用系统light。已修复dialog居中并加入几何断言、固定附加场景dark并断言实际主题；原截图保留，不用文件名代替主题检查。axe发现严重程度span缺role导致aria-prohibited-attr incomplete，已加role=img；原incomplete保留。订阅取消后重新打开恢复服务端集合，避免把未保存草稿误当已保存。lint脚本的structuredClone全局标记错误已修正。

## 冻结候选结果

源码 `7cdb23b46f1af6b790db480209f626a1fde15867`；attempt-01完整有界矩阵通过，工程Gate=PASS_UI_P23_ALERTS_HIGH_FIDELITY。前端/真实消费者85项（P23新增16、UI60335、消费者2、P18订阅17、导航15）；Rust operations21；Node门禁/路由/阶段政策62；新增Chromium7/7，当前UI603浏览器直接回归6/6，无重试、skip或flaky。typecheck/lint/构建（含client-secret检查）和计划通过，INTEGRATION退出1为预期拒绝，下一UI-601 DEVELOPMENT退出0允许。

8组dark/light × 1672/1440/1024/390几何及axe检查通过：0 violation，保留8项color-contrast incomplete（每组1项），原aria-prohibited-attr已修复。人工查看冻结候选居中dark确认弹窗、明确合成的dark六事件画面及light390详情下半部；已查看修复前实际dark1672/light390供布局核对。人工读屏/原生200%缩放NOT_RUN，不把自动扫描或截图等同完整无障碍/长页验收。

生成8张实际模块页面截图、2张移动详情、1张确认弹窗、1张明确合成多事件图；合成样本独立scope JSON标记，无业务写入。身份/CORS回环替代不升级为目标环境验收。

UI603/G4/FEP4历史包共217文件摘要与冻结源码相同，ORIGINAL_SCOPE_ONLY_UNCHANGED。159个stage_gate均NOT_ASSESSED；formalAccepted=false、runtimeAdmission=DENIED。G4/FEP-4原缺口与全部目标/CI/性能/RELEASE NOT_RUN未变。变更路径见changes.json，精确命令见attempt-01/executions.json，封包摘要见packet-manifest.json。
