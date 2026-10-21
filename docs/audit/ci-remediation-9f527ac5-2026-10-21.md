# 9f527ac5 远程 CI 修复（2026-10-21）

基线：`9f527ac5075098edd3690c0f6bb7467f0ccd8369`。从干净 main 开始，按完整 SHA 查询到 9 个已结束工作流，8 SUCCESS、1 FAILURE。本轮只生成本地提交，不推送、连接数据库或部署。

## 托管失败

唯一失败工作流为 [QuantOS CI 39576886249](https://github.com/SumAlphaAI/QuantOS/actions/runs/39576886249)。实际失败步骤是 Run SCA checks，发现以下 6 条未豁免告警；verify-download 因前置失败、CI_RESULT=skipped 连带失败，依赖判定保持不变。完整日志的 gh 步骤标签显示 UNKNOWN STEP，已结合 jobs JSON、时间与原始命令定位并提取 SCA 段，不依赖标签猜测。

| 依赖 | 基线版本 → 修复版本 | 告警与官方依据 |
|---|---|---|
| Vite | 6.4.3 → 6.4.4 | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv)、[GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw)、[GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm)，三条公告均提供 Vite 6.4.4 兼容修复线 |
| certifi | 2026.7.22 → 2026.10.19 | PYSEC-2026-4320 / [GHSA-6q48-6c7w-9gw2](https://github.com/advisories/GHSA-6q48-6c7w-9gw2)，更新根证书集合 |
| rustls-webpki | 0.103.14 → 0.103.16 | [RUSTSEC-2026-0382](https://rustsec.org/advisories/RUSTSEC-2026-0382.html)，拒绝已撤信任的中间证书公钥 |
| webpki-root-certs | 1.0.9 → 1.0.10 | [RUSTSEC-2026-0383](https://rustsec.org/advisories/RUSTSEC-2026-0383.html)，移除受影响根证书 |

Frontend Baseline、QuantOS Compatibility、F01、F03、F08、F09、R01 和 Visual Baseline Candidates 在基线 SHA 均 SUCCESS，完整状态见 remote-runs.json。成功范围属于原 SHA 的相应工作流，不改绑为本轮候选通过。

## 实际变更

仅修改 packages/ui/package.json 中 Vite 的最低补丁范围，以及 pnpm-lock.yaml、Cargo.lock、engines/uv.lock。没有修改业务源码、SCA 策略、ignore 或 waiver。

pnpm 初次定向更新还刷新了 Rollup、PostCSS、picomatch 与平台包解析。保留初次生成锁文件后，逐项核对官方 Vite 6.4.4 的依赖范围，保留满足范围的原传递版本；新 Vite package record 使用 pnpm 生成的原始完整性摘要。最终冻结安装成功，完整 YAML 结构比对确认仅 Vite 版本/来源记录、直接范围及相应 peer 引用变化。其他 npm 包身份与元数据保持原值。Cargo 两包只改变 version/checksum，Python 只改变 certifi 的版本及官方分发记录，其他 Rust/Python 包和锁文件约束逐项相同。

独立 Desktop Rust 锁未改动；deny.toml、security/sca-waivers.json、SCA 扫描/裁决脚本保持原字节。既有 braces 与 glib 回补继续通过原验证。Desktop 的 6 条既有上游维护告警仍保留，未将维护告警伪装成零发现；本轮没有新增豁免。

## 本地验证

| 检查 | 实际结果 |
|---|---|
| CI 同款 `make sca-check` | PASS：9 项回补正负控制通过，npm / pypi / cargo / cargo-desktop 四生态均 PASS；0 条未豁免且未修补的发现。braces 仍按既有精确回补验证处理 |
| `make lockfile-check` / frozen pnpm 安装 | PASS：52 Python 包解析、8 个前端 workspace 的锁与 manifest 一致 |
| `make license-check` | PASS：Rust licenses/bans/sources；754 个锁定 npm 包；42 个活跃 Python 依赖 |
| certifi 实际信任库 | 2026.10.19；SSLContext 成功载入 120 个 CA，emSign ECC Root CA - G3 不在集合中。未执行外部 TLS/数据库目标探针 |
| 认证/存储 Rust 库测试 | 6 + 22 = 28 PASS，0 ignored；编译使用更新的 Rust TLS 依赖 |
| `make coverage-web` | 普通 TypeScript：451 PASS、3 skipped；关键分支：349 PASS、3 skipped。6 个关键源码文件的 lines/statements/functions/branches 逐文件均 100% |
| UI Storybook 生产构建 | PASS：实际 Vite 6.4.4；保留构建产物较大等原始提示，不据此声称性能验收 |
| 锁文件范围、差异与密钥扫描 | 范围比对与 diff 检查 PASS；历史/暂存扫描见证据，无新增扫描例外 |

Vite 同时服务 Vitest 与 Storybook，本轮因此重跑现有 TypeScript 覆盖率和 UI 构建；Rust 回归选择直接使用 HTTP/TLS 依赖的认证、存储库。未递归重验历史 provider/业务验收，也没有执行本机 PostgreSQL/Supabase。原有 3 项 TypeScript skipped 不计为通过，没有新增 skip 或降低阈值。

本地 SCA receipt 诚实记录基线 source、dirty=true 以及四个锁文件摘要；四个摘要已与最终候选输入逐项匹配。receipt 不冒充新提交同 SHA hosted PASS。

[完整证据](evidence/ci-9f527ac5-20261021/)保留原托管日志 gzip、SCA 提取段与 FAIL receipt、官方公告原文、初次及最终解析范围、四生态原始扫描输出、本地实际命令结果和源码/证据 SHA256 manifest。候选以所在 Git 提交与清单共同标识，历史报告及原始失败未改写。

本轮 Gate：PASS_LOCAL_SCOPED。新提交 hostedCandidateGate=NOT_RUN；完整 clean-room/reproducibility、目标数据库、部署和发布验收本轮未执行。推送后仍须跟踪新 SHA 的远程工作流及后续制品/下载验证。
