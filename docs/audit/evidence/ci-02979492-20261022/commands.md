# 命令与验证范围

- `gh run list --repo SumAlphaAI/QuantOS --commit 02979492d85cdfef4def8f78a2532830cf716509 --json ...`：8 已完成，6 SUCCESS / 2 FAILURE。
- `gh run view <39711767895|39711767848> --repo SumAlphaAI/QuantOS --log-failed`、`--json jobs,headSha,event,conclusion,url`：两个原始失败及连带下载守卫失败。
- GitHub contents/ref/workflow-runs API：远程 main 为精确 SHA，两份 F05/F07 定义仅手工触发、默认不确认、同 SHA 均 0 次运行；近期历史任务均完成。主 CI 与 Makefile 调用链核对。
- `node --test scripts/npm-license-metadata.test.mjs scripts/manual-database-policy.test.cjs`：31 PASS。初次 CLI fixture MIT allowlist 缺失的失败单独保留；helper 原 21 项单测也保留。
- `node scripts/check-node-licenses.mjs`：实际 npm registry 清单 PASS，748 包/8 工作区、136 次尝试，其中 6 个首轮 502 后重试成功；固定 pnpm 10.20.0。
- `node artifacts/ci-02979492-20261022/verify-web.cjs`：读取 Frontend Baseline 的公开 NEXT_PUBLIC profile，移除数据库配置/实时测试开关；依次 `pnpm --filter @sumalpha/website build`、Terminal build、`pnpm check:pre03:web`、`pnpm test:pre03`；4 命令均退出 0。保存独立日志及用时。需要本机 HTTP/Chromium 权限，不建立或连接任何数据库。
- `node scripts/check-development-plans.mjs`、变更 JS 的 `node --check`、`git diff --check`：PASS。
- `GITLEAKS_BIN=artifacts/tools/gitleaks bash scripts/check-secrets.sh`：PASS；原始未压缩证据与暂存 diff 另扫描。

Node 24.12.0；本轮依赖/锁字节不变。未推送、未启动远程 CI、未执行 F05/F07 完整 campaign、未重跑无关 Rust/Python 验收。源文件摘要对应提交前实际工作树，不把工作树验证绑定为干净基线 SHA 通过。
