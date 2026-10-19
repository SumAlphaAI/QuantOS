# 657a67b8 五个 CI 工作流跟踪与第五轮修复（2026-10-19）

跟踪提交 `657a67b81b7a45f327dafbc05efe9b22b0682a9c`：五个工作流全部结束，2 成功、3 失败。在 main 修复并生成本地提交，未推送。历史报告、原始失败与验收记录保持原样。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果 |
|---|---|---|
| QuantOS Compatibility | [39199837344](https://github.com/SumAlphaAI/QuantOS/actions/runs/39199837344) | SUCCESS |
| F08 Engine CI | [39199837149](https://github.com/SumAlphaAI/QuantOS/actions/runs/39199837149) | SUCCESS |
| Frontend Baseline (FEP-0) | [39199837203](https://github.com/SumAlphaAI/QuantOS/actions/runs/39199837203) | FAILURE；进入 BFF-FE-006 后，当前输入与 aad08dd5 历史 READY manifest 不符，严格校验拒绝。上一轮 Chromium 缺失已消除。 |
| F01 Clean Room | [39199837155](https://github.com/SumAlphaAI/QuantOS/actions/runs/39199837155) | FAILURE；clean-room 终端测试 115 PASS / 5 FAIL；reproducibility 作业 SUCCESS。所有消费者已能启动 BFF，5 项冷领域读取触发十秒请求 TIMEOUT。 |
| QuantOS CI | [39199837123](https://github.com/SumAlphaAI/QuantOS/actions/runs/39199837123) | FAILURE；终端测试 116 PASS / 4 FAIL，同类冷读取 TIMEOUT；F02 归档及下载拒绝为前置中断的连锁结果。 |

## 当前阶段记录

BFF-FE-006 历史回执绑定 aad08dd5；源码、生成物、测试和 CI 前置已变化，不能将历史 READY 改绑到新候选。只将当前计划 stage_gate 恢复 NOT_ASSESSED、input_digest=null、evidence=[]，历史 manifest、日志、确认稿仍原字节保留。CI disposition 记录验证通过时 admitted=false；READY 仍调用严格校验并传播失败，不增加错误时自动回退或借用旧证据。当前直接功能回归继续执行，不重跑十个前置验收链。完整联调、发布与新 SHA 远程 CI 尚未执行。

## 冷请求超时修复

execution、strategy 与 operations 的首次加载会调用共同的 owned fixture；原实现逐次同步读入并哈希整个 debug 可执行文件，在 API 十秒请求期限内支付映像哈希成本。源码 SHA 校验、Cargo.lock 摘要及真实模块校验均必须保留。

改为在 reference provider 构造、报告 ready 之前完成映像摘要，以 64 KiB 缓冲区流式哈希，并只缓存进程中不可变的映像身份；逐次生成的业务时钟、源码 SHA、Cargo.lock 和领域状态不缓存。material 先取得摘要再生成当前时钟，避免冷加载消耗新输入有效期。Paper/Shadow 两种 reference 构造均执行准备；live router、API 十秒期限、风险有效期及权限拒绝不变。摘要工作前移后，将四个旧的十秒准备钩子对齐为其他消费者已有的三十秒启动预算（beforeAll 允许三十五秒清理余量）；不增加 API 或功能断言的期限。

本机常规映像约 59 MiB，三个首次领域请求各约 1.88 秒。为复现大 debug 映像的成本，在临时诊断构建中启用软件 SHA，并通过 macOS linker 加入 320 MiB 未使用数据段，得到约 382 MiB 可执行文件。修复前同一新增回归在十秒请求期限失败，三个领域请求实测约 11.1 / 11.1 / 11.0 秒；修复后 ready 约 15.73 秒，三个首次领域请求约 19.4 / 15.6 / 19.7 毫秒，五个原超时消费者及新增 helper 回归共 9 项通过。

临时数据段、force-soft 和 linker 参数均不进入源码或常规构建配置；诊断源版本、映像摘要、命令与原始日志独立保存。此为 macOS 受控复现，不声称已采样 Linux runner 的映像大小或 CPU，也不视为新 SHA hosted CI 通过。

## 本地验证

| 检查 | 结果 |
|---|---|
| BFF lib | 149 PASS / 0 FAIL / 1 ignored；含真实映像和 Cargo.lock 摘要、新领域状态及原五分钟时钟回归 |
| `cargo clippy -p bff-gateway --all-targets --locked --offline -- -D warnings` | PASS |
| BFF006 verifier / CI disposition / 开发计划负向回归 | 125/125 PASS，0 skip；历史或失效 READY 仍严格拒绝 |
| 全部当前组件 CI disposition | 17/17 记录验证 PASS，admitted=false；不等于功能准入 |
| 大映像首次请求回归与五个原超时消费者 | 6 文件、9/9 PASS；同一冷请求回归在修复前实测 TIMEOUT |
| terminal typecheck / lint | PASS |
| 全部终端大映像回归 | 固定 CI Node 24.12.0，从包工作目录运行，28 文件、121/121 PASS，0 skip；覆盖全部 13 个消费者及四个启动钩子调整 |
| 常规 `make test-web` | PASS / exit 0；固定 Node 24.12.0、pnpm 10.20.0；终端 28 文件、121/121 PASS，其余前端工作区通过，domain-ui 原有 3 项 skip 保留；已恢复约 59 MiB 常规二进制，确认无诊断数据段 |
| `cargo fmt --all --check` / `git diff --check` | PASS |
| Gitleaks 8.28.0 全历史及暂存补丁 | PASS；641 commits / 0 leaks；新增暂存补丁亦 0 leaks |

共享 reference 初始化变更影响各领域，因此执行整个 BFF lib 和终端组件回归，未递归重验上游 Gates。保留原有数据库 ignored；本机未启动或连接数据库。

初次源校验拒绝、冷请求超时复现、并行诊断构建中断、格式检查失败均保留原始日志。文稿创建过程曾出现报告目标尚未创建的链接错误；补齐报告后计划校验及 125 项回归通过。包目录相对 Vitest 入口未找到的尝试未执行测试；修正入口后另发现该目录 shell 使用 Node 23.6.0，其 121 项结果只作为额外诊断保留，再固定 CI Node 24.12.0 取得独立 121 项通过，不混淆运行版本。

## 证据与边界

[第五轮证据](evidence/ci-remediation-round5-20261019/)包含五个工作流终态、三个失败作业的原始日志、源码漂移诊断、修复前后大映像对照、常规功能验证与失败/中断记录。`manifest.json` 绑定本轮输入和证据 SHA-256，候选由所在 Git 提交标识；诊断执行期间的 base SHA 与本轮文件摘要分别记录。原 BFF006 manifest、确认稿及前四轮历史报告不重写、不改绑。

本轮 Gate 为 `PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）。未执行完整 F01 三轮验收、新 SHA F02 产物生成/下载、目标数据库、部署、发布或正式验收；下一步在授权推送后核对五个工作流的新同 SHA 终态。
