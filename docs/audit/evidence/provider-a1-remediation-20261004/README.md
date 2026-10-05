# PROVIDER:A1 整改功能证据

- 实际源码：`4eee7f755c03654be83dfbf4f53994951a04f4ae`；DEVELOPMENT，formalAccepted=false。
- 65 项必需检查当前有效结果全部 PASS；原完整轮 59 PASS/6 FAIL 或超时，六项同源完整复验全部通过。不是一轮无失败执行。
- [整改报告](../../PROVIDER-A1-remediation-2026-10-05.md)、[执行结果](./execution-results.json)、[continuation 证明](./continuation.json)。
- 945 个去重功能输入逐字节与实际执行提交的 Git blob 一致，执行前后要求/输入清单无漂移。
- [原始完整轮](./attempt-4eee7f7-interrupted/README.md)、[独立复验原始结果](./continuation-details/results.json)、[输入快照](./continuation-details/source-inputs.json) 分开保留。driver/publisher 代码是原 artifacts 路径的执行快照；正常候选完整复跑使用 pnpm assess:provider-a1。
- [三轮构建](./f01-reproducibility.json)、[原始分支覆盖](./f04-branch-coverage.json)、[1 万事件实测](./f05-volume.json)、[完整 F06 回执](./f06-target.json)、[reference HTTP](./reference-http.json) 由各节点 manifest 绑定。
- 使用既有 Supabase；未 provision/reset/migrate、创建本地 DB 或建桶；F09 ignored 用例仍 NOT RUN。

| 节点 | 输入文件 | 必需检查 | manifest 摘要 |
|---|---:|---:|---|
| [FE:PRE-01](./fe-pre-01.json) | 266 | 2 | `sha256:f670108e0682eaae536e86a8a232d1a4f9c8c6c38c4c677d1f1c61ef4d53e270` |
| [CORE:F01](./core-f01.json) | 764 | 5 | `sha256:ebddc39b1d9bfe67380f1b979b0381510de605ee3aa7074bdd2e682aab75cd9b` |
| [CORE:F03](./core-f03.json) | 406 | 3 | `sha256:07868f3d7c35f5c9a344002753e4795653719b84d8fd27adc9855b2615d2b7da` |
| [CORE:F04](./core-f04.json) | 275 | 5 | `sha256:a447a5d6cbc8e2cade6f7f49fa575a89e2b182a2dd89366781d3d6cb145a6c63` |
| [CORE:F05](./core-f05.json) | 320 | 10 | `sha256:80bffcb1beb9a7267a376410c0d33b8d912369ea22dd082858a4f6b6c8492090` |
| [CORE:F06](./core-f06.json) | 328 | 3 | `sha256:7eb10969930611b9d5ef1c134f0fde9687a97e36d1aeb63865c5a011825495c7` |
| [FE:PRE-04](./fe-pre-04.json) | 317 | 4 | `sha256:1f4cf82cc0e842784db09f02239a5cae61ddeeb7be5d84bf32791d89832fe546` |
| [FE:PRE-02](./fe-pre-02.json) | 301 | 3 | `sha256:baca11b544f665a46366ac01616a52c72166a7318605f5c915038f5fb5e387cc` |
| [FE:PRE-03](./fe-pre-03.json) | 355 | 5 | `sha256:e101b627898b8706033e180bd7f048320098b94a3babf250444d324f34bb25de` |
| [FE:PRE-05](./fe-pre-05.json) | 270 | 3 | `sha256:2a04cbbd55b2fbcc0327734dbeb84627d4c9119efba884884182bf28cae15c8b` |
| [FE:PRE-06](./fe-pre-06.json) | 374 | 8 | `sha256:b6c346c1097e07c7035f5da710e35dab890c6b579e0678d3e4fb1496bf8119f2` |
| [PREPARATION:P0](./preparation-p0.json) | 294 | 4 | `sha256:024fa58a3021a07e0252e011638c8a4d0de726cbe7c6c8719829c23affa6a024` |
| [FE:BFF-FE-000](./fe-bff-fe-000.json) | 323 | 10 | `sha256:57102270495873c46393107208422d6bc5f54d18db58cc1ade71f9b4873db8ff` |
| [PROVIDER:A1](./provider-a1.json) | 345 | 5 | `sha256:b986c85588aea7bc10e5e986bf42565e435c685446825154fa9402286e567aa3` |

## 历史失败与范围不足尝试

| 目录 | 保留事实 |
|---|---|
| attempt-5cb0619 / attempt-f7bf0c9 | Runtime 会话超时 |
| attempt-26bcee0 | F06 前六步通过，数据库步骤 native TLS 失败 |
| attempt-661a744 | Auth/BFF 超时 |
| attempt-520d1d4 | 48/54 PASS，旧 PRE-04 摘要与 Web profile 未闭环 |
| attempt-46d3827 | 53/54 PASS，Auth/BFF 503 |
| attempt-6d5c5d2-incomplete-scope | 54/54 但开发范围不足，READY 已撤回，不用于准入 |
| attempt-c3e6718 | 62/65 PASS，静态环境/Closed 传输/显式 UUID 误报，无 READY |
| attempt-4eee7f7-interrupted | 59/65 PASS，6 FAIL/超时，无 READY |

所有原日志/结果保持原字节。当前续验没有修改断言、视觉基线或目标数据计数，也未拼接 F06 步骤/消费批次。发布同 SHA CI、staging、安全签署、性能/长稳与完整平台仍由 RELEASE 收口。
