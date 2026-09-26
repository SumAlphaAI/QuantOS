# F02-A11 最终主线验收证据

验收源码：`bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f`。结果：7/7工作流、8/8 required checks、正式签名和独立下载验签全部成功。[收尾报告](../../F02-A11-main-acceptance-2026-09-26.md)说明范围与完整提交关系。

## 文件索引

| 文件 | 来源和用途 |
|---|---|
| acceptance-verification.json | 对下列原始元数据及远端回执的派生交叉校验，不是伪造的远端签发回执 |
| main-download-receipt.json | CI 36248006030 的 f02-download-receipt artifact；commit严格等于本main SHA，正式签名/下载均true |
| main-clean-room.json / main-reproducibility.json | F01 36248006066 原始回执；source.commit相同，冷启动242.47秒，三次摘要一致 |
| main-ci-run.json / main-ci-jobs.json | CI终态及各job原始元数据；verify、签名策略、正式签名、main下载验签和汇总检查均success |
| main-f01-run.json / main-frontend-run.json / main-compatibility-run.json | 其余required checks来源工作流的原始终态和源码 |
| main-workflows.json / main-check-runs.json | 固定完整SHA的工作流及check-run快照；含GitHub Actions App ID，校验不混入其他SHA |
| main-ruleset.json / main-effective-rules.json | active、strict、八项来源绑定、零bypass和main实际生效规则 |
| main-merge-rule-suite.json | 服务端规则审计4240581448；required_status_checks为pass，after_sha等于本main |
| merged-pr.json / main-branch.json | 正常合并PR #4及归档时main分支指向 |
| main-commit.json | GitHub提交身份、Git tree及父提交字段；省略大体积文件diff，不改变保留字段 |
| ci-artifact-index.json / f01-artifact-index.json | artifact ID、名称、摘要、大小和运行来源；没有保存临时签名下载URL或凭据 |
| pr-candidate/ | PR head 01b4f0600beeffbeaddfe3c6bcb780212b136073的8/8检查及F01回执；实际测试merge为bc5dddd251d0f3588d6fcba68b1fc09f9a1c3821，不冒充main |
| validate-receipts.py | 离线交叉校验，默认只读；核对源码、配置、规则审计、7工作流、8检查、签名job与原始回执，并验证文件摘要 |
| sha256-manifest.json | 本目录递归文件的完整性清单，排除自身 |

## 离线复核

在仓库根目录运行：

```sh
python3 docs/audit/evidence/F02-A11-main-bb4ef3c-2026-09-26/validate-receipts.py docs/audit/evidence/F02-A11-main-bb4ef3c-2026-09-26 bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f
```

正式签名在main专用远端环境执行，本机未读取签名密钥，也不把本地派生校验称为重新签名。文档归档提交与将来的新HEAD不自动继承本次源码回执。历史ac73a95失败、隔离PR #3的失败阻断及恢复、实际chunk字节重放证据均保留在各自证据目录。
