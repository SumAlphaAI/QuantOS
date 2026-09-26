# main 合并后验收收尾

## 结论与基线

[PR #1](https://github.com/SumAlphaAI/QuantOS/pull/1) 合并提交 `830c0c547f08d1667725fee55015fc09608b8f48` 已完成主线集成及 F08 验收收尾：合并触发的 7 个工作流全部成功，补充的 F08 Nightly 和隔离目标也在该完整 SHA 上成功。9/9 工作流成功，目标场景 9/9 PASS，本轮无需源码修复。F08 开发阶段 ACCEPTED 基线更新为该合并 SHA。

[汇总回执](./evidence/main-830c0c5/receipt.json)记录验收范围、运行 ID、覆盖率和 23 个证据文件的摘要；[工作流终态索引](./evidence/main-830c0c5/workflows.json)保留远端原始查询结果。文档归档提交及后续新 HEAD 不自动继承本次源码回执。

## 工作流与产物核验

| 工作流 | 运行 | 结果 |
| --- | --- | --- |
| QuantOS CI | [36238199280](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199280) | SUCCESS；verify、signing-policy、sign-main、verify-download-main、verify-download 均成功；PR 专用下载作业在 push 事件中按设计跳过。 |
| F01 Clean Room | [36238199287](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199287) | SUCCESS |
| F03 Protocol Acceptance | [36238199292](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199292) | SUCCESS |
| F04 Core Branch Coverage | [36238199329](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199329) | SUCCESS |
| Frontend Baseline | [36238199278](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199278) | SUCCESS |
| QuantOS Compatibility | [36238199285](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199285) | SUCCESS |
| F08 Engine CI | [36238199294](https://github.com/SumAlphaAI/QuantOS/actions/runs/36238199294) | SUCCESS；产物 source-sha.txt 与合并 SHA 一致，Python/Rust 覆盖率及负向探针通过。 |
| F08 Engine Nightly | [36239409436](https://github.com/SumAlphaAI/QuantOS/actions/runs/36239409436) | SUCCESS；以 main 手动触发并核对 headSha、source-sha.txt；分支覆盖率及 4 项负向探针通过。 |
| F08 Isolated Target Service | [36239615322](https://github.com/SumAlphaAI/QuantOS/actions/runs/36239615322) | SUCCESS；在 CI/Nightly 产物核验后推送 `f08-target-830c0c547f08` 标签触发。 |

[主线正式制品回执](./evidence/main-830c0c5/formal-download-receipt.json)绑定合并 SHA，`downloadVerified=true`、`formalSignatureVerified=true`；这是远端独立下载验签作业的原始成功回执，本轮未读取签名密钥，也未在本机重复下载整个发布包验签。

F08 CI 的原始 LLVM line/region 为 95.88%/90.38%，物理源码行 97.64%，豁免后 region 92.88%；Nightly 原始 line/region/branch 为 94.21%/86.84%/87.33%，物理源码行 95.92%，豁免后 region/branch 为 89.32%/90.07%。Python SDK/Mock 八个生产源文件均达到 85% 行覆盖率。原阈值、127 项可审计豁免和负向探针未变。

[隔离目标回执](./evidence/main-830c0c5/target-receipt.json)及逐项日志核验 9/9 PASS：五 RPC/租户拒绝、受监督三次崩溃、两秒 deadline、运行中取消、持久重建、Manager OS 强杀和重放策略、幂等/改输入、制品完整性、不可信 RPC 拒绝。环境为独立 Ubuntu 24.04 runner，目录权限 0700，Mock 从 site-packages 加载，wheel 实算摘要与回执一致。目标服务验收不代表生产部署。

## 独立剩余事项

1. **F02-A11 仍 OPEN。** 本次已补齐当前主线成功 CI、正式签名及独立下载验签证据；[实际生效规则](./evidence/main-830c0c5/main-effective-rules.json)仅有 deletion 和 non_fast_forward，缺 required checks 实际阻断/恢复证据。本次没有修改规则或套餐，也不把一次 CI 成功当成强制阻断能力。历史 F02 完成率不在本轮重算。
2. **F09 仍待全面复审。** development_status=COMPLETED 不代表 review_status=ACCEPTED；下一项为可观测性、容量阈值、持续窗口、故障恢复和 ADR 证据核验。
3. **F0 整体尚未放行。** F02、F09 及阶段清单仍须独立闭环。旧 `033eebde` 的 F05 Nightly、TP01 Vibe Sync Gate 失败记录不由本轮成功覆盖；其当前有效性和原因在对应任务复审时处理。

本轮主线集成与 F08 收尾已完成，上述独立事项继续进入后续任务，不扩大本次 PASS 的范围。
