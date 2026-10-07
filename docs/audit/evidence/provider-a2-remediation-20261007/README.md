# PROVIDER:A2 整改证据说明

此目录用于关闭原 B-01 / H-01 / M-01 / L-01，保留实际执行、输入摘要、负向反例和当前报告的生成/复核程序。原初审在 `../provider-a2-review-20261007`，原报告及旧确认均独立归档。

- 主修复源码：`f5cd6e3`；预期403负向探针兼容性补充：`50faf3f`。最终工程执行冻结提交由 `closure-verification.json.sourceCommit` 记录。
- 最终 F0/A1 87个唯一组有效结果：`../provider-a1-remediation-20261004/provider-a2-clean-final-reassessment-20261007/effective-execution-results.json`；同目录保留原87次（85 PASS / 2失败：F05 Closed及新增证据脚本Ruff格式）及完整8项补测记录。
- 早期沙箱网络/缓存拒绝、首次87/87完成、身份刷新误拒绝、提前写入日志触发干净工作树拒绝均保留。未完成/失败执行不用于发布READY。
- A2目标原件不改写。身份7项、Audit13项源码与不可变目标提交及当前字节逐项核对；本轮自身目标调用未重跑。F0/A1所要求的数据库检查实际连接配置的Supabase，不建立本地数据库。
- `negative-summary.json` 汇总四次实际门禁调用的127项正负向用例，包含22契约、44身份阶段、30 Audit契约/阶段、31窗口阶段；不是单次调用，也不作为需求完成率分母。
- `closure-probes.mjs` 针对当前真实子回执，先做严格基线校验，再仅在内存修改失败状态、SSE及提交标识，执行11项拒绝探针。无额外外部账户副作用。
- `collect-closure.mjs` 严格校验26个已评估节点、当前依赖及20项目标源文件；G0/FEP-0工程PASS、确认前的BLOCKED原件与实际用户确认后的READY分别记录。
- `write-current-reports.py` / `update-current-plans.py` / `validate-current-docs.py` 维护当前报告、计划摘要、完成矩阵与文档链接。所有归档保留原字节。

从工程根目录运行探针和收集程序；执行前需完成基础、子任务与A2/G0/FEP-0评估。Node/pnpm沿用项目pin，目标凭据只由已有配置读取，不写入证据。

最终以 `closure-verification.json`、专用 `development/provider-a2.json` 及当前计划 `stage_gate` 的实际严格验证为准。DEVELOPMENT READY不等于正式ACCEPTED、当前HEAD hosted CI、staging或RELEASE。

`rerun-f05-database.mjs` 只对已观察到的连接Closed失败执行同一完整8项命令；`publish-effective-foundation.mjs` 仅在原87组全部完成、失败仅为记录的F05连接中断及F08新增证据脚本格式、两个完整补测PASS、所有规范输入与冻结Git字节一致时构造有效执行清单，调用既有标准严格门禁核验全部21个回执再发布阶段。原失败与执行时间不覆盖。

F08新证据Python脚本的格式已修正，全仓库Ruff和F08原完整命令实际重跑通过；保留首次失败和补测日志，不用单独Ruff PASS替代完整F08。最终有效87个唯一命令组，首次85 PASS/2 FAIL，补测两次后87 PASS（准入选用89次命令组；另保留说明文字更新前的1次F08成功复跑，最终冻结源码本轮实际90次，详见execution-accounting.json）。
