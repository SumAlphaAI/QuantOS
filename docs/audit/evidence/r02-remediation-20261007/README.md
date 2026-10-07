# R02 整改证据索引

日期：2026-10-07。来源为本次工作区修复；基线 Git SHA 为 `6aa5b9ee5c42e1527fbad47cfec4e71282340db9`。逐文件内容绑定见 `source-files.json`，全部证据 checksum 见 `index.json`。工程证据不自动授予 READY、ACCEPTED、部署、商业用途或同 SHA 远程 CI。

- [整改报告](../../R02-remediation-2026-10-07.md)：13 项工程关闭、28 控制统计、风险与下一阶段。
- [初审报告](../../R02-comprehensive-review-2026-10-07.md)：不可变基线；原 SHA 的原始报告/失败证据不改写。
- `target-attempt06/`：PASS，clean LLVM profile、排除 tests 的五生产文件覆盖，26 测试（19单元+7目标边界）、cleanup PASS。当前覆盖只验证相同的生产文件内容，不将后加权限迁移说成已在该轮执行。
- `target-attempt08/`：最终全部七项 migration 之后的原生 PG1/R02边界2/HTTP3/真实Storage1；受限成员读、跨租户拒绝、writer SET与直接表拒绝、既有对象失败不丢失和显式恢复、cleanup 回执。
- `target-state.json`：实际 migration ledger checksum、三表 FORCE RLS、恢复台账 explicit deny、所有 grantor 的 role membership、全部八轮测试 actor inactive、无临时 fault trigger；数据库元数据/审计/intent 保留。
- `logs/`：默认/显式无DB Gate、fmt、Clippy、compile_fail、实际 Python Engine消费者、协议、计划38负向与迁移静态。
- `closure.json`：逐项工程关闭和独立未完成边界。
- `validation.json`：离线 checksum/source/link/control/清理/真实环境 secret-value 扫描结果。

## 失败保留

attempt01：lineage SQL element别名歧义；attempt02：writer SET受限；attempt03：HTTP坏字节fixture长度不符，失败覆盖profile仅诊断；attempt05：SQL整行参数引用格式错误。上述原 receipt/日志不替换。attempt04/06/07 PASS 仅适用各自 sourceFiles 和当时 migration，不迁移为最终全量证据。

readback-attempt01：诊断表名错误42P01；target-state-attempt02：误取单个 grantor SET选项；target-state-attempt03：完整回读证实新 grantor 默认 INHERIT=true，随后用第七项迁移显式关闭，再验证有效SET及全部INHERIT=false。`role-readonly.json`/`role-options-readonly.json` 为缩小自动审批拒绝动作前的只读证明，不代表最后的角色状态。

途中结构负向/旧fixture/source副本lock/Engine socket/Buf网络/pnpm入口失败均保留原日志；最终对应成功日志独立命名。覆盖诊断失败不能算覆盖PASS。初审 native补偿丢对象为当时实证，不能由本次恢复测试改写成初审通过。

## 离线复核

```sh
node --env-file=.env.local docs/audit/evidence/r02-remediation-20261007/validate-evidence.cjs
```

此命令不连接数据库，只用环境值做原值/URI编码/数据库密码扫描，不打印凭据。初审 checksum 使用原 Git tree 读取，不要求当前 HEAD 仍为基线，也不要求旧源码仍存在于工作区。复核器校验最终 source 内容和全部证据索引，不重写失败目录。索引不含自身及可重跑的 validation.json；所有其他证据与执行脚本均受 checksum 保护。

重跑目标必须另选空证据目录、有效具名actor与授权环境；最终actor停用、仅本次拥有对象清除。不要删除/UPDATE不可变数据库事实，不建立本地数据库。查询基线包含网络/协议/读取校验，默认不强制 RELEASE<300ms；完整真实消费者/HTTP部署/发布容量与正式确认仍未完成。
