# d7fe13ec 远程 CI 修复（2026-10-21）

基线：`d7fe13ecf4f8b89fc6f674cbcc4b1411f1aca478`。从干净 main 开始，最初主 CI 仍在执行，随后只读跟踪至所有工作流结束；最终 9 个工作流中 5 SUCCESS、4 FAILURE。原始状态、期间快照及最终状态均保留。本轮只创建本地提交，不推送、连接数据库或部署。

## 托管失败及根因

| 工作流 | 同 SHA 运行 | 原始失败 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39609653407](https://github.com/SumAlphaAI/QuantOS/actions/runs/39609653407) | PRE-03 受控版本仍固定 Vite 6.4.3，拒绝上次已升级的 6.4.4。 |
| F08 Engine CI | [39609653257](https://github.com/SumAlphaAI/QuantOS/actions/runs/39609653257) | Python 1906 PASS、1 FAIL；TP08 当前生成研究封装的环境摘要已随 uv.lock 改变，受控示例仍为旧字节。 |
| F01 Clean Room | [39609653167](https://github.com/SumAlphaAI/QuantOS/actions/runs/39609653167) | 隔离源码测试同一 TP08 样例失败；独立 reproducibility job 在原 SHA 已通过。 |
| QuantOS CI | [39609653347](https://github.com/SumAlphaAI/QuantOS/actions/runs/39609653347) | Test workspace 同一 TP08 样例失败；Python 1906 PASS、1 FAIL。verify-download 因前置失败连带失败，依赖门禁保持不变。 |

其余 F03、F04、F09、R01 和 QuantOS Compatibility 在基线 SHA SUCCESS。这些结果只属于原 SHA 对应工作流范围，不改绑为本轮候选通过。SCA 在本轮主 CI 因前置失败而跳过，不能宣称该 SHA 的远端 SCA 已通过。

上次依赖升级遗漏了两处当前基线同步：PRE-03 的版本表/门禁，以及 TP08 的环境绑定示例。本轮补齐同步，不回退安全依赖、不降低门禁或移除逐字节比较。

## 修复与完整性复核

PRE-03 的 expectedLockedVersions 与运行时 ADR 同步到 Vite 6.4.4；manifest、锁和依赖代码保持基线原值。新增三个定向拒绝场景，明确要求旧 6.4.2、6.4.3 以及未审阅的 7.0.0 在版本规则上失败。现有 29 项锁版本、完整 importer/包图、ADR、构建来源、真实资源/脚本烟测与错误拒绝均继续执行。

TP08 使用原 `third_party/qlib/experiments.py` CLI 重新生成当前 `mappings/` 示例和 receipt。生成器及所有依赖锁未修改。逐字段/逐字节核对确认：只有研究封装的 environment_hash、外层 content_hash 和 receipt 中该文件的摘要变化；另两份映射、三个实体对象、输入/对象引用、合成诊断结果、代码版本与 reference_only/禁止交易/禁止上游运行时/禁止上传边界完全一致。历史审计目录、签署和验收证据保持原字节；旧当前示例另存 before gzip，原提交也可完整恢复。

Python 新增当前环境摘要的独立断言及锁字节变异测试：将一份临时锁副本改变后，环境封装及其外层摘要必须改变，而所有业务字段和三个物理对象必须保持相同。该测试防止用固定旧 environment_hash 绕过依赖身份。现有 CLI 与受控示例的精确字节比较继续保留。README 明确当前可重放示例的维护方式，不将示例刷新升级为历史或正式验收。

## 本地验证

| 检查 | 实际结果 |
|---|---|
| Website / Terminal 生产构建 | PASS，使用 CI 的完整公开 local-mock 配置，生成各自当前来源 receipt |
| `pnpm check:pre03:web` | PASS：29 项锁版本、2356 项契约检查、2 条实际浏览器路由烟测 |
| `pnpm test:pre03` | 32 PASS，0 skip；包括新增 Vite 拒绝及现有坏资源/脚本/来源/配置拒绝 |
| TP08 Python 映射/拒绝/重放 | 41 PASS，含当前锁绑定、锁变异及全部当前示例字节一致性 |
| TP08 Node 验证与负向探针 | 30 PASS，CLI schema/integrity 验证 PASS |
| 静态及范围核验 | 修改 Python 测试 Ruff、两个 Node 脚本 node --check、样例字段/对象/收据摘要、diff 检查 PASS |
| 密钥扫描 | 历史与暂存日志见本轮证据，无新增扫描例外 |

额外诊断曾直接把根 ESLint 配置套用于 Node 工具脚本，该配置在仓库 workspace lint 范围外产生 Node 全局及既有未用绑定诊断：基线 25 条、当前 26 条，诊断种类全部已在基线出现；新增一处标准 structuredClone 用法增加同类诊断。原始 FAIL 与比较保留，没有把此尝试计为 PASS，也未为此放宽规则。本轮脚本语法与实际正负门禁均已独立通过。

[完整证据](evidence/ci-d7fe13ec-20261021/)保存原托管日志、主 CI 的最终失败、旧样例、当前构建 receipt、本地命令和语义复核，以及源码/证据 SHA256 manifest。候选由所在 Git 提交与清单共同标识。

本轮 Gate：PASS_LOCAL_SCOPED；hostedCandidateGate=NOT_RUN。完整 F01 clean-room/reproducibility、完整 F08 stable Gate、目标数据库、部署和发布验收本轮未执行。推送后仍须检查新 SHA 的全部远程结果及后续制品/下载步骤。
