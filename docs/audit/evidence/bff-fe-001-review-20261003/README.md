# BFF-FE-001 复审证据

源码基线：`28deabe961404fcde35791ea757b352c79e558fa`。本目录证明本轮审查的观察结果，不是整改完成回执。完整问题和范围见[报告](../../BFF-FE-001-comprehensive-review-2026-10-03.md)。

| 文件 | 用途 |
|---|---|
| notes-publication.json、remote-*-tree.json | 两个 notes 的原子推送、远端 ref 与本 SHA blob 一致性；不包含凭据 |
| p0.log、f06-gate.log | 写审计文件前的干净 SHA 回执准入校验 |
| inspection.json | 24 项统计、15 项问题 ID 与优先级 |
| reference-observations.json、probes.mjs | 16 个参考 HTTP / 当前 auth/settings consumer / SSE reducer 观察；真实源码 transpile 后执行 |
| live-observations.json | 20 个 live operation：3 成功、17 路由缺失；实际已配置 Supabase 会话，本机 BFF，非 staging |
| gate-observations.json、gate-probes.mjs | 5 个实质 Gate 破坏输入均误放行；仅内存修改，不改仓库 |
| a2-gate.log、a2-negative.log | 原 A2 正向与 10 个原有测试 |
| terminal-test.log、reference-unit.log、contract.log | 68 Terminal、8 Rust、24 contract 测试结果 |
| reference-http-contract.log/.json | 28 个参考 HTTP 请求的同源 schema 验证；不是全业务验收 |
| ci-runs.json、*-ci.json | 当前 SHA 的托管 workflow/job/step 结果 |
| *-ci-failed.log.gz | GitHub 原始失败日志的 gzip 副本，保留原始字节；避免把巨型日志当源码格式修复 |
| manifest.json | 所有存档文件 SHA-256、字节数与相对路径 |

在仓库根目录使用工程固定 Node 24.12.0 / pnpm 10.20 工具链执行。输出目录选 `/private/tmp`，不要覆盖存档或将输出误认作新验收。

```sh
node docs/audit/evidence/bff-fe-001-review-20261003/gate-probes.mjs /private/tmp/quantos-a2-review-replay
node docs/audit/evidence/bff-fe-001-review-20261003/probes.mjs /private/tmp/quantos-a2-review-replay
```

第二条会构建并启动本机 loopback/reference BFF，创建临时 transpile 文件，无数据库操作。观测 JSON 中的缺陷值（例如 inputSaved=false、错误 mutation.actual=PASS）表示复现成立，不能算功能通过。

只有需要重新执行 live 验证时才在第二条加 `--live`。脚本从既有 `.env.local` 读取工程 Supabase 配置，对现有测试主体进行 Auth 登录，创建并撤销自己的 BFF 会话；不输出凭据，不 provision/reset/migrate 数据库，不建立本机 PostgreSQL/Supabase。需具备已有配置与网络，不将失败或跳过记成数据库验收。它仍不包含真实部署、浏览器 Cookie/CORS E2E 或联合签署。

P0/F06 的 source SHA 与 clean-tree 限制独立于这些探针。审计文件未提交时，不将当前脏工作区的 gate 结果冒充干净源码验收。
