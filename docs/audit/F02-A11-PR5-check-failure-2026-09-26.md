# F02-A11 PR #5 核验失败排查

## 1. 结论

- PR：<https://github.com/SumAlphaAI/QuantOS/pull/5>。
- 失败提交：`fc773c9c130d88e22bad6511fc40b0f7ade2d126`。
- 根因：归档新增的 `evidence/F02-A11-main-bb4ef3c-2026-09-26/validate-receipts.py` 未满足全仓 Ruff 规范。归档前仅执行回执校验，遗漏 `make lint-python`。
- 8 处错误：E401 × 1（合并 import）、E731 × 1（赋值 lambda）、E702 × 5（分号合并语句）、E701 × 1（冒号后同一行语句）。

## 2. 失败链与证据

| 检查 | 远程日志 | 失败原因 |
| --- | --- | --- |
| QuantOS CI / verify | [run 36249622267](https://github.com/SumAlphaAI/QuantOS/actions/runs/36249622267) | `Lint workspace` → `Makefile:109 lint-python` → Ruff 8 errors |
| F01 / acceptance (clean-room) | [run 36249622268](https://github.com/SumAlphaAI/QuantOS/actions/runs/36249622268) | 隔离源码执行 `make lockfile-check f01-check lint test`，同一 Ruff 错误 |
| F08 / f08-stable-gate | [run 36249622249](https://github.com/SumAlphaAI/QuantOS/actions/runs/36249622249) | `Makefile:184 f08-check` 全仓 Ruff 扫描，同一错误 |
| QuantOS CI / verify-download | 同 CI run | 上游失败使 `verify-download-pr` skipped，汇总 Gate 按设计失败 |

CI 中 `artifacts/f02/` 未生成的上传错误也是 lint 提前终止的后果。此次 F01 reproducibility 已通过；这些失败日志未显示构建字节漂移。

## 3. 修复及本地验证

1. 拆分 import、多语句行，将 `read` lambda 改为具名函数，并格式化脚本；保留原校验断言。
2. 仅更新证据清单中该脚本的 SHA-256 与长度，原始 GitHub 回执和既有验收摘要保持原值。
3. `make lint-python`：全仓 Ruff PASS；Pyright 0 errors / 0 warnings。
4. 执行 `validate-receipts.py` 校验既有 `bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f` 证据：PASS，8 required checks、7 workflows、正式签名及下载验证通过，清单摘要一致。
5. `git diff --check`：PASS。

## 4. 验收边界

此次仅修复归档脚本规范。PR 新提交须重新取得远程检查结果，既有 main 回执仅证明其绑定的 `bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f`。未来归档包含可执行脚本时，提交前须运行该语言的全仓 lint 及归档回放命令。
