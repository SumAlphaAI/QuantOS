# 执行命令

- `gh run list --repo SumAlphaAI/QuantOS --commit 59d0fb1e5586d6edba01f78a0e545c240e196b62 --json ...`：9 个已完成 push workflows，8 SUCCESS / 1 FAILURE。短 SHA 查询最初未匹配，最终全部结论使用 git rev-parse 解析出的完整 SHA。
- `gh run view 39704571354 --repo SumAlphaAI/QuantOS --log-failed` 与 `--json jobs,headSha,event,conclusion,url`：原始失败 SCA 及连带下载守卫失败。
- GitHub contents API（ref=上述完整 SHA）：两份手工工作流、主 CI、Makefile 和手工策略模块逐字匹配；workflow runs API：同 SHA 的 F05/F07 均 0；最近历史运行均 completed。
- 官方 GitHub Advisory Database：GHSA-f2ph-cmg5-wxc8、GHSA-qxg6-89mg-rqv8、GHSA-xp26-3454-mjgp；npm registry `pnpm view storybook@8.6.19` 与 `pnpm view vitest@4.1.12` 核对已发布包和精确 mocker 依赖。
- `pnpm install --no-frozen-lockfile`：一次更新安装；随后 `CI=true pnpm install --offline --frozen-lockfile`：PASS。
- `node scripts/check-sca.mjs npm`：PASS；`node scripts/check-node-licenses.mjs`：PASS。
- `pnpm coverage:web`：共享 Vitest/v8 升级的直接影响回归；清空 DATABASE_URL/SUPABASE_URL、QUANTOS_SKIP_ENV=1、F05/F06/F07/F09 live switches=0；使用 HTTP mock 监听权限，无真实数据库操作。
- `STORYBOOK_DISABLE_TELEMETRY=1 pnpm --filter @sumalpha/ui build-storybook`：PASS。
- `pnpm --filter @sumalpha/ui --filter @sumalpha/domain-ui typecheck`：PASS。
- `GITLEAKS_BIN=<工程 artifacts/tools/gitleaks 绝对路径> node --test scripts/manual-database-policy.test.cjs scripts/f05-gate-negative.mjs scripts/f05-coverage.test.mjs scripts/f02-gate-negative.mjs scripts/tests/glib-backport.test.mjs scripts/braces-backport.test.mjs`：37 PASS。
- `GITLEAKS_BIN=artifacts/tools/gitleaks bash scripts/check-secrets.sh`、`git diff --check`：PASS；暂存差异另经 Gitleaks stdin 扫描。

Node 24.12.0，固定 pnpm 10.20.0。两个初次本地环境失败及对应复验分别保留，不拼接为同一成功尝试。依赖版本升级不需要重跑 Rust/数据库全量，也未启动远程 CI 或推送。
