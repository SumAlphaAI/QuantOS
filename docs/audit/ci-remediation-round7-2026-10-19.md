# b80fbda8 五个 CI 工作流跟踪与第七轮修复（2026-10-19）

基线：`b80fbda8b3a5e6c2fd31ef0cfbf7927ce0516d7f`。五个工作流均进入终态，4 成功、1 失败。本轮直接在 main 修复并生成本地提交，未推送；前六轮报告与原始验收记录保留。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39216544925](https://github.com/SumAlphaAI/QuantOS/actions/runs/39216544925) | SUCCESS |
| F01 Clean Room | [39216544913](https://github.com/SumAlphaAI/QuantOS/actions/runs/39216544913) | SUCCESS |
| QuantOS Compatibility | [39216545001](https://github.com/SumAlphaAI/QuantOS/actions/runs/39216545001) | SUCCESS |
| F08 Engine CI | [39216545025](https://github.com/SumAlphaAI/QuantOS/actions/runs/39216545025) | SUCCESS |
| QuantOS CI | [39216544869](https://github.com/SumAlphaAI/QuantOS/actions/runs/39216544869) | FAILURE；Run SCA checks 报告主 Rust 锁文件 rustls 0.23.45 的 4 项漏洞。 |

上一轮 PRE-04 及 Rust 覆盖率修复均已通过远程门禁。主 CI 的 workspace 测试、Python/TypeScript/Rust 覆盖率、许可证、SCA 豁免和 TP intake 检查通过。SCA 中 npm、pypi、cargo-desktop 均 PASS，只有 cargo FAIL。verify-download-ci 因前置失败跳过，verify-download 汇总拒绝为连锁结果；后续 F02 数据库、打包、完整性及下载检查仍未执行。

## 修复与影响

`cargo update -p rustls --precise 0.23.46` 仅更新 Cargo.lock 中 rustls 的版本和 registry 校验值。锁文件共 353 个包，其他 352 个包、所有依赖边、workspace manifests、Desktop 独立锁、扫描策略和豁免均不变。

四项公告均以 0.23.46 为修复下界，已核对 [官方 release](https://github.com/rustls/rustls/releases/tag/v/0.23.46)：

- [RUSTSEC-2026-0346](https://rustsec.org/advisories/RUSTSEC-2026-0346.html)：client session Debug 输出暴露 TLS secrets。
- [RUSTSEC-2026-0347](https://rustsec.org/advisories/RUSTSEC-2026-0347.html)：ECH 拒绝后仍向 outer server 发送缓冲的应用数据。
- [RUSTSEC-2026-0348](https://rustsec.org/advisories/RUSTSEC-2026-0348.html)：Brotli 证书解压可在认证前大量分配内存。
- [RUSTSEC-2026-0349](https://rustsec.org/advisories/RUSTSEC-2026-0349.html)：未认证 ServerHello 污染后续连接的 key-exchange hint。

本轮通过已修复版本移除扫描命中，不以某功能未开启或业务路径暂未使用为理由豁免。现有 braces backport 与 Desktop GLib backport 验证保持有效；Desktop 的既有 unmaintained 提示保留。

rustls 经 reqwest/hyper-rustls/tokio-rustls 进入认证、Storage、行情、BFF，并由策略测试使用。本轮选择这些直接消费者的库测试、行情二进制单元测试及 BFF auth/settings、audit/export provider 集成测试，验证请求、拒绝和失败处理行为。Supabase 目标数据库测试及真实远程 TLS 联调未执行，不把 HTTP fixture 测试提升为目标 TLS 验收。

## 本地结果

| 检查 | 结果 |
|---|---|
| 实际 make sca-check | PASS；9/9 backport/拒绝测试，npm/pypi/cargo/cargo-desktop 四项均 PASS；主 Rust 无 advisory 命中 |
| quantos-auth / quantos-storage / quantos-strategy 库回归 | 6 + 22 + 29 = 57 PASS、0 FAIL；策略原有 2 项 target/performance ignored 保留 |
| market-ingestor Binance 单元测试 | 5 PASS、0 FAIL、0 ignored；重试/致命错误、endpoint host 拒绝、时钟诊断、映射与停止流程 |
| BFF auth/settings 与 audit/export provider 集成 | 29 PASS、0 FAIL、0 ignored；既有权限、拒绝及数据完整性 fixture 用例 |
| Rust 许可证 / bans / sources | PASS；保留既有 duplicate 提示 |
| 豁免 / locked metadata / 开发计划一致性 | PASS；0 exact waiver，26 workspace members |
| 历史 Gitleaks 8.28.0 | PASS；643 commits、0 leaks；新增暂存补丁扫描结果见 local/staged-secret-scan.log |

直接消费者共 91 项 PASS、2 项既有 ignored；另有 SCA 9 项 backport/拒绝测试 PASS。全部命令原文与日志索引见 local/checks.json。

## 证据与边界

[第七轮证据](evidence/ci-remediation-round7-20261019/)保留五工作流终态、原始失败日志与作业状态、从原日志提取的 SCA receipt、升级命令、前后依赖树、实际扫描 receipt/压缩原始输出及相关回归日志。manifest.json 以所在 Git 提交标识修复候选，并绑定输入/证据文件 SHA256；本地运行 receipt 的 source 保留执行时 b80fbda8 + dirty=true，不伪装成已运行新提交。

本轮 Gate：`PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）。b80fbda8 的 4 个 SUCCESS 仅绑定原 SHA；推送修复后仍需核对新同 SHA 五工作流及本轮尚未抵达的 F02、打包、下载步骤。本机未启动或连接数据库，未重新执行全仓测试、完整 clean room 三轮构建或发布验收。
