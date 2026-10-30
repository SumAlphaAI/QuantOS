# 未冻结诊断记录

所有 GITHUB_SHA 仅标识启动时旧 main，不是当前源码验收。保留原始失败、缺少输出与成功诊断；不得改作冻结通过。

- domain-01：7 pass/1 fail；平仓 realizedPnl 预期漏计0.02费用，改为194.98。domain-02/04为对应新测试成功诊断。
- composition-02/03：测试导入 account_domain / std::thread 错误导致编译拒绝，未产生现金场景回执。
- composition-04：三条公共用例通过，但后续独立证据校验发现 C10 读投影重复风险 eventId；cash-04 保留并由 Gate 反例拒绝。
- composition-05：2 pass/1 fail；唯一风险投影已修复，测试误将每次查询正常追加的 audit.search_accessed 当成不应变化。未输出 cash-05；expiry/refusal-05保留。
- composition-06：现金/拒绝通过；过期用例的3秒初始窗口被BFF启动耗尽，拒绝409，未输出expiry-06。改为20秒原账户窗口，按实际 Snapshot 原截止等待，不续期或改风险限额。
- composition-07：3 pass，cash/refusal/expiry-07作为 Gate 受控反例的诊断输入，不是当前冻结验收。
- consumer-01：11 pass/2 fail；UI model 未把 Subject 中两份可选来源复制到 Command，修复共享模型后consumer-02/03通过。受控模型不授予实际IO。
- lint-01：no-control-regex；改用 Node stripVTControlCharacters。
- gate-tests-01：未导出safe；gate-tests-02：source反例错误传入修改后的自身source作为期望；修复后gate-tests-03通过，gate-tests-04补三条source/ledger/deadline拒绝。
- build-02/05 的 Cargo JSON 保留实际 emitted executable；预检后续复用其本地路径，仅正式运行重新build并提取实际路径/hash。
- consumer/types/lint/clippy/format/inventory/plans日志为各次独立诊断，正式attempt重跑当前具名检查。
