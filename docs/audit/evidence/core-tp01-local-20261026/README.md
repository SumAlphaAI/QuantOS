# CORE:TP01 执行报告 · 2026-10-26

当前功能开发COMPLETED，工程Gate **PASS_OWNED_LOCAL_TP01_RESEARCH_COMPOSITION**。完整业务联调 **PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN**；stage_gate仍INTEGRATION/NOT_ASSESSED。formalAccepted=false、runtimeAdmission=DENIED，目标与发布NOT_RUN。

冻结检查候选 `92fc827c763393d45f9ae553d3c26dd57a301652`；实现提交`92c66a19`，组合fixture注册修正提交`92fc827c`。本目录后续证据提交不把结果改绑为新HEAD。仅修改QuantOS，在main提交；没有推送、部署、GitHub/fork写入、上游拉取、生产凭据或外部发布。

## 变更与消费闭环

新增data-only ResearchArtifact envelope，保留QuantOS身份、snapshot/policy和workflow/stream语义；trade_executable=false，tools_executed=false。R03加入精确的research.vibe_adapter.execute能力，必须经独立session/tool权限、批准Engine manifest及既有worker校验后归档。新增能力不会由hypothesis权限自动授予。

实际本机路径：Web P03创建意图→reference C03→R03 coordinator/runtime→EngineManager→vibe-adapter Python UDS→canonical ResearchArtifact/evidence/stream record→C04 API与Audit→P04/Artifact/Evidence页。20个固定fixture逐项保存原始worker record并核对页面及API，另验证排队取消。没有用代理替换完成状态或产物。共享宿主变化直接回归U01的五个场景。

受控fork仍使用仓库内v0.1.13锁定源和两项等价改写队列。workflow和stream设计吸收保持原范围；工具/MCP/记忆是参考设计，未执行工具、未接入上游MCP server或记忆文件，adapter没有venue/secret/shell权限。许可证结论只属于已锁定字节，历史CVE结果不当作新扫描。完整文件清单见[changed-files.txt](changed-files.txt)，固定来源与历史证据适用范围见[intake-scope.json](intake-scope.json)。

## 命令和实际结果

本轮17组检查均符合预期；Python449、Rust15、门禁Node78、同步Node23、Chromium26项通过。同步分类另有12个受控输入场景，保留预期拒绝退出码；不重复计为单元测试。无跳过或flaky浏览器场景。复核命令：`node scripts/core-tp01-review.mjs --verify`。

| 检查 | 实际命令 | 结果 |
| --- | --- | --- |
| readonly-intake | `node scripts/check-vibe-repositories.mjs --baseline third_party/vibe-trading/baseline.lock.json --remote-lock forks/vibe-trading/repository.lock.json --readonly third_party/vibe-trading/upstream-src --allow-missing-fork 1` | PASS；固定v0.1.13只读源；fork=pending-auth |
| patch-queue | `node scripts/tp01-d-patch-queue.mjs` | PASS；两项等价改写 |
| sync-blocking | `node --input-type=module -e import {record} from './scripts/tp01-e-functional.mjs';record({outputDirectory:process.argv[1]}); docs/audit/evidence/core-tp01-local-20261026/attempt-02/sync` | PASS；23个Node回归+12个分类/拒绝场景（预期非零保留） |
| python-adapter | `engines/.venv/bin/python -m pytest -p test_vibe_adapter_skeleton engines/tests/test_vibe_adapter_contract.py engines/tests/test_vibe_adapter_skeleton.py engines/tests/test_vibe_adapter_absorption.py engines/tests/test_vibe_adapter_rollout.py engines/tests/test_vibe_adapter_replacement.py engines/tests/test_vibe_adapter_research_artifact.py -vv --junitxml=docs/audit/evidence/core-tp01-local-20261026/attempt-02/python.xml` | 449/449 |
| python-lint | `engines/.venv/bin/ruff check engines/vibe-adapter/src engines/tests/test_vibe_adapter_research_artifact.py` | PASS |
| python-format | `engines/.venv/bin/ruff format --check engines/vibe-adapter/src/vibe_adapter/research_artifact.py engines/vibe-adapter/src/vibe_adapter/service.py engines/tests/test_vibe_adapter_research_artifact.py` | PASS |
| runtime-current | `cargo test --locked --offline -p quantos-runtime --lib research::` | 7/7；含Vibe确切授权拒绝 |
| runtime-detached | `cargo test --locked --offline -p quantos-runtime --test research_orchestration` | 6/6；实际RD-Agent/R03及vibe导入禁用 |
| manager-adapter | `cargo test --locked --offline -p quantos-engine-manager --test python_vibe_adapter` | 2/2；实际Vibe UDS全RPC与拒绝 |
| host-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | PASS |
| gate-tests | `node --test scripts/core-tp01-review.test.mjs scripts/development-execution.test.mjs scripts/tp01-d-patch-queue.test.mjs` | 78/78 |
| lint | `pnpm exec eslint scripts/core-tp01-review.mjs scripts/core-tp01-review.test.mjs tests/e2e/fixtures/u01-reference.ts tests/e2e/tp01-integration.spec.ts playwright.tp01.config.ts` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS；159个stage仍NOT_ASSESSED |
| tp01-browser | `pnpm exec playwright test --config playwright.tp01.config.ts --project chromium --output docs/audit/evidence/core-tp01-local-20261026/attempt-02/tp01-browser --reporter=list,json` | 21/21；20个workflow+1排队取消 |
| u01-browser | `pnpm exec playwright test --config playwright.u01.config.ts --project chromium --output docs/audit/evidence/core-tp01-local-20261026/attempt-02/u01-browser --reporter=list,json` | 5/5 |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:TP01` | 预期exit 1：STAGE_NOT_READY |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:R1` | PASS；CORE-GATE:R1 DEVELOPMENT允许 |

准确命令、执行时间、退出码、信号与日志摘要见[executions.json](attempt-02/executions.json)。Python有原始JUnit及逐用例日志；两个浏览器报告分别为[TP01](attempt-02/tp01-browser.json)、[U01](attempt-02/u01-browser.json)。实际record、取消回执、网络摘要及宿主日志均在对应browser目录。同步目录保留API破坏、许可证变化、CVE、patch冲突、S2/S3及无效输入的原件和decision records。

Web产品源码和依赖未变，复用U01候选`4d5362e1cca41a72f826c80e3c7f41f9c430f56d`的既有静态导出；记录原buildId、182个导出文件hash并核对产品输入未变，buildReexecuted=false。没有将旧Web构建记为新候选构建，也没有重跑旧SERVICE:TP01的31节点/三轮构建或F05/F07 campaign。新的R03/Python/宿主代码已实际编译/运行。

## 保留的失败与边界

初次未提升权限的Python探测因沙箱不允许UDS监听而产生20个setup error，业务断言未执行；该事实保留在原会话工具记录，本报告只记录摘要，不伪造原始stdout文件。

exploratory-01为未冻结工作区诊断：20个新envelope测试及首条Web组合通过，不能作为冻结候选验收。attempt-01绑定92c66a19：前三组来源/同步检查通过，Python组合388通过、61个setup error，因为共享adapter fixture按模块收集而未暴露；其余检查NOT_RUN。原日志、JUnit及输入完整保留。显式预加载测试插件后，exploratory-02的449项通过；最终候选92fc827c在attempt-02完整重执行本任务矩阵并通过。没有删除失败或把停止项记PASS。

当前Web表单的公开hypothesis意图由受信测试宿主映射到固定Vibe fixture/内部能力；不是生产BFF能力选择。BFF→worker run映射、reference cookie身份、自签TLS/CORS、内存C03/C04及engine Artifact facade均为显式端口替代。R03实际执行和canonical归档不证明Supabase/Storage、真实OIDC或持久队列已执行。Python内的取消/deadline/回滚通过也不能代替跨持久模块的完整恢复。

待补：正式BFF Vibe路由、持久HTTP队列/C04 Storage、完整运行中取消/deadline/重启恢复链、真实身份与fork远程治理、完整浏览器/人工可访问性及全仓联调；目标数据库、7天canary、目标回滚时效、监测/部署、性能/长稳、同SHA远程CI和发布仍NOT_RUN。没有重授SERVICE:TP01、U01、FEP-2、G2/R1或历史确认READY。

下一可执行原项为 **CORE-GATE:R1 当前研究闭环评估（DEVELOPMENT）**，其实际入口已返回allowed=true。完整INTEGRATION仍按缺口独立拒绝。
