# F04 最后一项已确认 CI 阻断整改

修复提交：`c5a34164676cd275b728d17ccb4914309d8b9dde`。日期：2026-09-21。

**本地整改与完整验收 PASS；修复后的同 SHA 远端 CI 尚待人工推送。F04 继续保持 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION，F02 A11 保持开放。**

## 修复范围

针对 [5e7a0f1 核验报告](F04-remote-acceptance-5e7a0f1-2026-09-21.md) 的 SCA yanked 阻断，执行 `cargo update -p chacha20`，只将 Cargo.lock 中 `chacha20 0.10.1` 更新为兼容的 `0.10.2` 及其 registry checksum。其他依赖、manifest、供应链策略与 waiver 均未变更。保留 `yanked = "deny"` 及不可豁免 scanner failure 规则。

Cargo.lock SHA-256：`1e068a20e1d22d553fca38d075ca6e2a79b1c174b49ab98a3957e92e598b2bc7`。

## 本地验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 全量 npm/Python/Rust SCA | PASS，三个生态均无未获准 findings；新版本未触发 yanked 拒绝 | [绑定干净修复 SHA 的回执](evidence/F04-yanked-remediation-2026-09-21/sca.json) |
| cargo-deny bans/licenses/sources、Node/Python 许可证 | PASS；Node 726 包、Python 42 个活跃锁定依赖 | [日志](evidence/F04-yanked-remediation-2026-09-21/supply-chain.log) |
| workspace release locked build | PASS | [日志](evidence/F04-yanked-remediation-2026-09-21/build.log) |
| workspace locked test | PASS | [日志](evidence/F04-yanked-remediation-2026-09-21/test.log) |
| F04、proto-check、lockfile-check | PASS；50 Schema 生成无漂移，11,000 fixture 六向二进制及六向 ProtoJSON 通过 | [日志](evidence/F04-yanked-remediation-2026-09-21/gates.log) |
| 三轮隔离构建 | PASS；新源码、安装及构建目录，三次输出摘要一致 | [完整回执](evidence/F04-yanked-remediation-2026-09-21/three-runs.json) |
| 独立 clean-room | PASS；空下载缓存，446.945 秒 | [完整回执](evidence/F04-yanked-remediation-2026-09-21/clean-room.json) |

三轮构建与 clean-room 均绑定干净提交 `c5a3416`。三轮组合摘要均为 `e739ac5b64b221e554fbbeb813323df77be1a2168b3a57d50e426ebed71e0473`，未复用旧锁文件的构建回执。clean-room 模式的 `reproducible: false` 不表示失败，多轮输出一致性由独立三轮回执验证。

构建/测试/门禁与许可证日志来自提交前同一修复工作树；正式 SCA 在提交后重跑，结构化回执的 source 为完整修复 SHA、dirty=false。本机默认 cargo-deny 0.18.4 首次被版本门禁拒绝；随后在独立临时目录安装项目固定 0.20.2 重跑成功，未更换全局工具或放宽版本校验。

## 人工推送后的验收

通过 GitHub Desktop 推送修复与文档提交后，收集最新完整 SHA 的 QuantOS CI、F01 Clean Room、Frontend Baseline、F03、F04、Compatibility 最终结果。尤其核验此前尚未到达的数据库/RLS、F02 recovery、runtime packaging、sign-main、verify-download-main。只有必需回执全部成功后才关闭 F04；本地 PASS 不代表远端已验收。
