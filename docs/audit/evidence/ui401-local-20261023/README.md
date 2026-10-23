# UI-401 本机功能证据

当前任务为 I4 UI-401（C12 `/markets`）。工程结果、候选完整 SHA、输入摘要、命令与数量以 `receipt.json` / `result.json` 为准；`node scripts/ui401-review.mjs --verify` 复核。最终回执尚未生成时不得把本 README 或预检当作通过。

preflight-01：沙箱禁止 loopback listen，Chromium webServer EPERM，浏览器未执行，保留 browser.log/report。先前受同一限制阻塞的 consumer 进程手动中断（exit 130），没有完整结果，不算 PASS。

preflight-02：使用获准的 loopback 测试方式；unit/consumer 通过，但源码尚未冻结；Chromium 5/9 通过、4/9 失败（包含 1 个 timeout）。首次筛选测试等待 Venue 的隐式 label，错误场景 selector 同时命中 Next 路由 announcer；为 Venue 添加显式 aria-label 并将 alert 断言限定到实际 main。保留原始日志、报告与失败截图，不改写失败为 PASS。

另：初始 typecheck exit 2（TerminalFrame 不支持 route prop，冲突 base 可能 undefined）已修复。初始未冻结的功能测试 35/35、添加不可见引用/恢复429后 37/37，Rust C12专项18/18和Terminal构建曾通过；仅作为开发过程记录，不替代最终冻结候选证据。原始命令输出见会话，未冒充本目录完整回执。

范围：实际生成 API client + 本机 reference BFF/C01/C12/R01；受控合成输入、临时 TLS/cookie/CORS 替代；不等于真实市场、生产身份或持久数据库。完整INTEGRATION stage_gate NOT_ASSESSED；formalAccepted=false，runtimeAdmission=DENIED。目标Supabase/许可/IdP/Cookie/CORS/持久恢复、全I4/发布、跨浏览器/人工读屏/native200%、远程同SHA CI及性能长稳均 NOT_RUN。下一原任务 FE:UI-P18。
