# 组件 CI 与 DEVELOPMENT 准入检查

GitHub Actions 的组件检查与计划中的阶段准入是两种结果。组件 lint、类型检查、单元测试、契约/变异测试、构建、浏览器和发布产物验证继续执行；绿色 workflow 不自动产生阶段回执或业务确认。

## 组件 CI

`scripts/ci-stage-disposition.mjs` 读取现行计划中的 DEVELOPMENT 状态，不发布回执，不修改计划。CI 日志输出 `quantos-ci-stage-disposition/v1`：

| 计划状态 | 检查行为 | 日志结果 |
| --- | --- | --- |
| `NOT_ASSESSED` | 必须为 `input_digest=null`、`evidence=[]`，且依赖节点存在 | `status=NOT_ASSESSED`、`assessmentExecuted=false`、`admitted=false` |
| `READY` | 执行原有严格验证器，校验当前输入、回执和递归依赖；任何失败阻断 CI | 验证成功才记录 `admitted=true`；`formalAccepted=false` |
| `BLOCKED` | 仅 G0/FEP-0 支持，原有验证器必须确认实际工程 PASS 与当前 BLOCKED 回执 | `assessmentExecuted=true`、`admitted=false` |
| 缺失/非法状态或不一致证据 | 拒绝 | 非零退出 |

`recordValidation=PASS` 只表示上述状态记录检查通过。`NOT_ASSESSED` 时没有执行阶段功能评估，不能据此启动依赖于 READY 的任务，也不能记作 Supabase、部署、RELEASE 或正式验收通过。

CI 调用 `pnpm check:provider-a1:ci`、`check:f0-development:ci`、`check:fep0:ci`、`check:g0:ci`、`check:bff-fe-001:ci`、`check:bff-fe-007:ci`、`check:provider-a2:ci`。所有回执负向测试继续强制运行。`pnpm test:ci-stage-disposition` 验证 pending 不授予准入、非法 READY 不回退到 pending、CI 不可禁用以及严格准入入口不可替换。

## 阶段准入

以下原有严格入口保持不变，阶段复评/放行时独立执行；未评估状态仍应非零退出：

| 节点 | 严格命令 |
| --- | --- |
| PROVIDER:A1 | `pnpm check:provider-a1` |
| CORE-GATE:F0 | `pnpm check:f0-development` |
| FEP-0 | `pnpm check:fep0` |
| G0 | `pnpm check:g0-development` |
| BFF-FE-001 | `pnpm check:bff-fe-001:development` |
| BFF-FE-007 | `pnpm check:bff-fe-007:development` |
| PROVIDER:A2 | `pnpm check:provider-a2` / `make provider-a2-check` |

真实复评必须执行各节点既有规程；目标数据库结果、用途许可、项目用户确认和同 SHA hosted CI 分别核验，不能复用迁移前 READY 推定当前准入。

## Python lint 范围

`make lint-python` 与 `make f08-check` 统一排除 `docs/audit/evidence/` 中归档的执行脚本，以及原有第三方上游源码目录。历史证据保留原始字节，不作为生产 Python 源码维护。活动 Python 代码仍在 lint 范围内；可复用的维护脚本应放入 `scripts/` 或对应工程模块。

两个目标均运行 `scripts/python-lint-scope.test.mjs`：在临时文件目录用真实 Ruff 验证业务/脚本目录中的错误会失败，而归档证据/上游快照不会被改写或纳入常规 lint。此临时目录只含 Python 文件，不包含数据库。
