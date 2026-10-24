# UI-P23 本机验收证据（2026-10-24）

运行 `node scripts/ui-p23-review.mjs --verify`；源码候选、精确命令/结果和产物摘要以receipt/result为准。preflight为未冻结工作树检查，不作版本绑定验收；保留全部已记录失败与修复前截图。正式结论须由后续完整冻结attempt确认。

当前首轮unit.log保留1个fixture权限集合缺execution.operate导致的断言失败；unit-2.log为修正后的检查。初次类型检查发现presentation排序括号语法错误，终端输出未保存，不宣称有其版本绑定原日志；已修正。其他结果依原日志记录，不覆盖旧失败。

证据范围：真实Rust reference C01/C10/C11/C16消费者与受控X06/F09；cookie身份桥接/TLS CORS代理为替代。六条混合事件图为明确SYNTHETIC_C16_PRESENTATION_ONLY，不代表提供方真实多事件、业务处置或外部告警验收。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL与原未决缺口保持；旧UI603/G4/FEP4证据只作ORIGINAL_SCOPE_ONLY，不修改或重绑。

preflight浏览器7/7功能检查通过后，人工查看发现确认弹窗受全局reset影响停在左上角，以及两个名为dark的附加截图实际采用系统light。已修复dialog居中并加入几何断言、固定附加场景dark并断言实际主题；原截图保留，不用文件名代替主题检查。axe发现严重程度span缺role导致aria-prohibited-attr incomplete，已加role=img；原incomplete保留。订阅取消后重新打开恢复服务端集合，避免把未保存草稿误当已保存。lint脚本的structuredClone全局标记错误已修正。
