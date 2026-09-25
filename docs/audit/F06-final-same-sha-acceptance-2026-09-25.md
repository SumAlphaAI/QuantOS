# F06 最终同 SHA 目标验收与 A10 状态治理

> 日期：2026-09-25。当前目标范围以 [F06 Gate 边界修正](./F06-gate-scope-correction-2026-09-24.md)、[A09 同区域范围修正](./F06-A09-gate-scope-correction-2026-09-25.md)及[开发机远程延迟范围修订](./F06-A09-remote-latency-gate-withdrawal-2026-09-25.md)为准。最终结论存放在绑定完整 SHA 的 Git note `refs/notes/f06-acceptance`，由 `make f06-acceptance-gate` 校验。

## 判定规则

`development_status=COMPLETED` 只标识开发基线。当前完整验收要求 F06 `review_status=ACCEPTED`、A01–A10 全部 `CLOSED`、干净工作树、Git note 的 `sourceCommit=HEAD`、`schema=quantos-f06-target-acceptance/v2`、总 `status=PASS` 且 `failures=[]`，以及真实 Auth/BFF、Execution/Vault、拒绝矩阵三组均为 `PASS`。开发机跨区域 P95 是可选诊断，不参与总 Gate。回执不放进被它引用的 Git 提交中，以免提交回执后 HEAD 变化造成无法成立的自引用。

读取和复验命令：

```bash
git notes --ref=refs/notes/f06-acceptance show HEAD
make f06-acceptance-gate
```

该 Git note 是独立的 Git ref，GitHub Desktop 推送 `main` 不保证同时推送它。向其他验收者共享时，须另外同步 `refs/notes/f06-acceptance` 并让对方在同一 SHA 重跑 Gate；仅有本地 note 的 PASS 不等于远端已归档。

## 先行复验与边界

在已推送的 `e4e6331185172cf44a195b72e5c945d4b65ed4d5` 上，真实 Auth→live BFF 9 项 HTTP、Auth→BFF→Runtime 身份拒绝链、Execution 进程经受限 Vault 到 paper kernel 六场景、四角色两路径 8/8 Vault 拒绝、四类拒绝 4/4、数据库实际执行 8 项均通过；这是后续提交前的历史证明，不自动替代新提交自身的同 SHA 目标回执。该提交的 P95 307.655ms 是旧验收范围的历史测量。

Runtime 测试按此前隔离项目授权临时使用高权限 Storage key，未执行 Storage 操作；该 key 不是正式服务凭据。Terminal 浏览器、MFA 页面与全部页面 API 联调属于后续 Web Gate；同区域 <100ms 属于首次同区域部署后的性能目标。`db-schema-diff` 仍缺新建参考库地址，不能称为 schema drift PASS。
