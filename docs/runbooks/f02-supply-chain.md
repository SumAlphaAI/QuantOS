# F02 门禁运行与验收

本地命令均设置 `QUANTOS_SKIP_ENV=1`，不加载项目 `.env`。工具版本以仓库版本文件和 CI 为准。2026-09-17 用户批准将 Python 从 3.9 升级为 3.12，当前固定为 3.12.10；升级全部 8 个 Engine 的版本约束、锁文件、CI、Ruff/Pyright 和测试依赖。F01 历史 3.9 回执仅证明其原源码，不自动覆盖本次升级。

## 扫描与失败语义

- `make license-check`：Rust cargo-deny 0.20.2；全部 pnpm 锁包（含 dev/build/其他平台）；Python 所有激活依赖组。未知许可证失败。LGPL 条件见 [批准记录](../adr/20260917-f02-license-intake.md)，不得作为全局准入。
- `make sca-check`：Node 全量依赖阻断 high/critical；Python 所有依赖组及 Rust advisories 阻断已知漏洞。网络错误、解析失败、扫描器缺失均失败。原始报告及裁决位于 `artifacts/f02/`。
- `security/sca-waivers.json` 必须指定生态、包、精确版本、漏洞 ID、责任人、理由和有效期；三个扫描器统一消费，不能豁免扫描器故障。本次不新增漏洞豁免。
- `bash scripts/install-gitleaks.sh` 安装 checksum 固定的 8.28.0；设置 `GITLEAKS_BIN` 后运行 `make quality-gate-self-test`。真实 Git 历史扫描加载默认规则；测试必须先证明正常输入通过，随后按明确诊断确认破坏被拒绝。
- `QUANTOS_PROTO_BASE` 在 PR 使用 base SHA，在 main push 使用 before SHA；缺失、全零或与 HEAD 相同均失败。本地默认 HEAD 的父提交。

## 临时数据库与已有 ledger

CI 必须启动专用 PostgreSQL 17.10 服务，并提供 loopback `F02_PG_ADMIN_URL`。`make f02-db-check` 创建两个随机数据库，执行全部迁移、检查内容 SHA 和目录结构一致性、回放、注入结构/RLS 破坏，并检查双用户双租户访问和匿名拒绝；完成后删除测试库。该测试不代表 Supabase 托管实例验收。

本地有 PostgreSQL server 二进制时：`PG_BIN=/path/to/postgres/bin bash scripts/run-f02-local-db.sh`。脚本创建专用临时 cluster，随机 loopback 端口，退出时停止并清理。不得将业务数据库 URL 当作测试环境。

已有 `schema_migrations` ledger 无 SHA 时故意拒绝，不能自动按当前文件填充或隐式信任历史。旧数据库迁移必须另行核实当时已部署 SQL、备份和独立基准目录，记录批准的基线恢复方案后处理。`db-schema-diff` 要求独立 `QUANTOS_REFERENCE_DATABASE_URL`；仅文件名相同不算无漂移。

## 制品与回执

在干净的已提交源码上运行 `make f02-package`，构建并收集全部 Rust 二进制、8 个 Python wheels、一期 7 个 Web/package 输出、锁文件、NOTICE、许可清单和 SPDX SBOM。`artifacts/release/manifest.json` 包含 commit、tree、工具版本、每个文件的长度和 SHA-256；SBOM 也绑定同一提交。

`make sign-artifacts` 签 manifest，manifest 递归绑定所有 payload；`make verify-artifact-signatures` 验签后核对缺失、多余、篡改文件和 Web 包内禁止的原生构建依赖。主干必须提供 `QUANTOS_SIGNING_KEY` 且要求正式签名；PR 的无密钥 digest 仅是完整性检查。

CI 上传 payload 后由独立 `verify-download` job 下载复验，生成带 SHA、run URL、attempt、签名状态的 `f02-download-receipt`。主干 HMAC 密钥不得写入仓库或本地证据。正式验收还需远程成功运行和 required checks 配置回执；本地通过不能填写远程 PASS，也不自动授权 push 或发布。
