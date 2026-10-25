# 7955c5cd CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `7955c5cd3f381284ebf1d6b2fbded35a50a7b5a0`，在 main 修复并生成本地提交，不推送。源码工作树摘要见[证据目录](evidence/ci-7955c5cd-20261025)的 `source-binding.json.gz`；本地结果不改绑为新提交的 hosted CI 或发布验收。

## 远端结果

该 SHA 的 9 个 push 工作流全部结束，5 成功、4 失败；另有 Dependency Graph 动态检查成功。Frontend Baseline、QuantOS Compatibility（三浏览器）、F04、F09、R01 均成功。

| 失败工作流 | 失败原因与本轮处理 |
|---|---|
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40188953892) | Python `test_cli_generated_samples_match_tracked_bytes` 失败；重新生成绑定当前 Python 锁的 TP08 示例 |
| [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40188953922) | 同一 TP08 字节不一致；同一修复覆盖两个入口 |
| [F03 Protocol Acceptance](https://github.com/SumAlphaAI/QuantOS/actions/runs/40188953897) | Buf 在约 120 秒后返回 `deadline_exceeded: context deadline exceeded`；增加阶段日志及有界传输重试 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40188953889) | TP07 拒绝测试在 `PaperProcessKernel::spawn` 处返回 `kernel spawn failed`；消除测试即时写入可执行文件的模式，并保留原始系统错误诊断 |

QuantOS CI 的 verify-download 正常传播上游失败。F03 receipt 也正常记录原失败；均保留既有失败门禁，没有跳过或改记 PASS。原始日志、终态与 job 元数据完整压缩归档。

## 修复与适用范围

上轮 filelock 升级改变 `engines/uv.lock` 字节，TP08 研究 envelope 的环境摘要随之变化。按已有 README 规则运行 `experiments.py --output third_party/qlib/mappings`，只更新当前研究示例的 environment_hash、content_hash 和 receipt 对应文件摘要。三份对象、其他示例、合成输入、上游固定版本和所有历史审计证据均保持原范围。保留锁变化绑定测试和逐字节比较，不去除 provenance。

网络相关 Buf 步骤统一使用 `scripts/run-buf.mjs`。仅明确的 `Failure: deadline_exceeded:` 或 `Failure: unavailable:` 状态允许最多三次尝试，间隔 1 秒、2 秒；全部尝试的原始输出均保留。耗尽、信号、启动失败、schema/lint/plugin/兼容性错误继续失败。生成物漂移、冻结语料、可信 baseline、六个固定插件和 buf.lock 规则保持有效。实际本地 Buf 检查本轮首次尝试即成功；重试与耗尽由负向探针验证，不声称复现了远端网络故障。

TP07 原测试每个模式现场写入、chmod 后立即执行 Python 文件。现改为已提交的固定可执行脚本，通过模式名符号链接选择原有七种错误行为。测试不再打开执行脚本进行写入；环境隔离、50ms 请求超时、二次提交拒绝和下游只执行一次的断言全部保留。生产启动/交易超时不变。启动错误现在包含操作系统原因，测试另记录失败模式，并以实际不可执行文件验证错误诊断。

原 F01 日志已经丢弃系统 errno，**确切系统原因为 UNKNOWN**。Linux 可执行文件锁竞争是针对旧夹具模式的推断，未在本机 macOS 复现原远端时序；固定脚本消除了该竞争路径，新增诊断用于继续定位其他系统启动失败。不得把此项局部通过描述为 Linux 故障已获得同 SHA 确认。

## 验证

| 本地范围 | 结果 |
|---|---|
| TP08 Python 当前示例、绑定及拒绝测试 | 41 PASS；逐字节比较恢复 |
| F08 实际 Python 测试与覆盖率入口 | 1908 PASS，覆盖率 90.77%；`check-f08-python-coverage.mjs` PASS |
| TP08 evaluation、历史 artifact 拒绝及 F05/F07 手工策略 | 51 PASS，其中手工策略 6 项；未执行 campaign |
| Buf 重试、配置固定、手工 baseline 与 receipt 拒绝测试 | 14 PASS；覆盖重试成功、耗尽、源码错误、信号和 ENOENT |
| `bash scripts/check-proto.sh` | PASS；实际远程生成、生成物无漂移，breaking 对比可信基线 `3548844b981b2830af3941b1c28752c4eb5a36f2` |
| `make proto-compat-check` | PASS；11,000 fixtures、六个二进制方向、六个 ProtoJSON 方向、三份冻结 golden、15 个无效 JSON 探针 |
| `cargo test --locked --offline -p quantos-execution --lib` | 52 PASS、1 项原有 ignored；未把 ignored 记为通过 |
| execution-gateway 的 tp07_process、x04_process、service_x06_process | 最终脚本格式化后再次执行，9 PASS；实际独立子进程、超时、错误回复、取消和恢复 |
| 执行库与 gateway `cargo clippy … --all-targets -- -D warnings` | PASS |
| 全仓既有 Ruff 范围、Rust fmt、两个 shell 语法检查 | PASS；新 Python 夹具已纳入实际 Ruff 检查 |

没有因这些修复重跑完整 F01 三轮构建、完整 F08 Rust 覆盖率、前端构建或浏览器矩阵。原 SHA 已成功的检查保留原范围，新提交 hosted CI、Linux clean-room、完整联调、真实数据库和发布验收均为 `NOT_RUN`。

## 证据与后续

证据的 `.gz` 可用 `gzip -dc` 无损读取，完整性见 `SHA256SUMS`。`validation-summary.json.gz` 记录结果和未执行范围；`execution-notes.json.gz` 保留中间格式修正、Cargo 缓存锁等待及根因不确定性；`source-binding.json.gz` 绑定修复源码字节和执行权限。凭据检查另在最终提交前执行。

该 SHA 完整工作流清单中 F05/F07 运行数为零；两份配置仍仅允许 workflow_dispatch，确认默认 false，并要求 `QUANTOS_MANUAL_F05_F07=1`。本轮没有连接真实数据库、修改 secrets 或执行全量 campaign。

下一步：用户推送本地修复提交后，跟踪同一新 SHA 的四个失败入口及后续步骤；若 F01 再出现系统启动失败，依据新增 errno 和模式诊断继续定位。
