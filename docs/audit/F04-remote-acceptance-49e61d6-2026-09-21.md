# F04 同 SHA 验收续检：49e61d6

核验日期：2026-09-21；完整 SHA：`49e61d65413ab342f5301b39a34ea09a4496f1b5`，main，2026-09-21 07:50 GMT+8 push。以下为已登录 GitHub 页面及日志的转录记录，不是本地下载验签回执。

## 已确认的结果

| 检查 | 回执 | 结论 |
|---|---|---|
| Linux Chromium 套件 | [QuantOS CI #102](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816717)，job `106171386002`，step 16 | **27 passed (23.7s)**，前次三个视觉失败消除，未更新截图或阈值 |
| stable F04 Gate | [verify job](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816717/job/106171386002)，step 26 `Validate F04 core primitives and deterministic fixtures` | 已执行 30s，完成后执行 migration 及 quality-gate-self-test；其日志确认执行 `make f04-check`，3 个门禁负向测试通过；本次未完整转录 coverage/P95 数值，不沿用旧 SHA 数值作为新回执 |
| F04 nightly | [F04 Core Branch Coverage #3](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816674)，job `106171385754` | **SUCCESS**，总耗时 1m56s；branch job 1m51s |
| 主 CI 总结果 | [QuantOS CI #102](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816717) | **FAILURE**，12m27s；失败位置已推进到 step 28 的质量门禁自检 |

已上传的页面制品元数据：

- `ci-browser-comparison-49e61d65413ab342f5301b39a34ea09a4496f1b5`，[artifact 10616513438](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816717/artifacts/10616513438)，7.21 KB，GitHub digest `sha256:fa3ea36fd5325751ed3b9c7623a559e73aa0f22a43ea4e7b7f449d45f8cf5010`。
- `f04-branch-49e61d65413ab342f5301b39a34ea09a4496f1b5`，[artifact 10616777592](https://github.com/SumAlphaAI/QuantOS/actions/runs/35545816674/artifacts/10616777592)，21.1 KB，GitHub digest `sha256:8e62c608edbb4e7ed1f6b6b88c9e8905458a0ea36336abfe08dd06872b486d64`。
- 本轮未下载制品；页面 digest 不代表本地验证或正式签名验签。

## 新阻断与本地修复

远端 `quality-gate-self-test` 为 20/24 PASS、4 FAIL。Cargo、uv、pnpm manifest drift 和 malformed Buf lock 四项测试均在正常对照阶段报相同错误：

```text
failed to load manifest for workspace member /tmp/f01-negative-.../tools/proto-json-codegen
failed to read .../tools/proto-json-codegen/Cargo.toml
No such file or directory (os error 2)
101 !== 0
```

原因：`scripts/f01-gate-negative.mjs` 的 `lockFixture` 只复制 crates/services，遗漏 Cargo workspace 的 tools 成员。测试尚未进入预期破坏阶段，不能视为负向门禁有效。

本轮补齐 tools 源目录，保留正常对照及预期错误断言；执行 `PATH=/opt/homebrew/bin:$PATH node --test scripts/f01-gate-negative.mjs`，**16/16 PASS**。同时让 F04 workflow 对该自检脚本变更触发，以取得修复提交同 SHA 的 branch 回执。验证日志见 [本地回执](evidence/F04-recheck-2026-09-21/lock-gate.log)。

## 验收边界

视觉阻断已远端关闭；主 CI 完整成功条件仍未满足。后续 lint、workspace test、coverage、供应链和制品阶段被自检失败阻断；签名与下载验证仍未完成。F04 保持 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION，不改变 F02 A11 状态。

下一步：人工推送本轮自检修复提交，再收集该完整 SHA 的主 CI 与 F04 nightly 成功回执。不得将当前 SHA 的部分成功与下一 SHA 的其他结果拼接为一次验收。
