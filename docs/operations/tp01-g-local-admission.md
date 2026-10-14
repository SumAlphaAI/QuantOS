# TP01-G 本地开发准入

范围是 QuantOS-native 模块替换、协议不变与上游可审阅 patch。`TP01-G_LOCAL` 仅登记 `CORE:TP01-G` 的 DEVELOPMENT；实际执行其完整 30 节点必要闭包，内部 `LOCAL_READY` 属于 G 消费者，不能传播成前置任务、SERVICE:TP01 或 R1-SERVICE 的独立准入。

## 实现与证据

服务构造时可注入 contract provider、context translator、workflow planner、audit builder、stream projector 和 Artifact store。接口位于 `engines/vibe-adapter/src/vibe_adapter/modules.py`，不引用 fork 内部类型。原生 policy、协议 codec、租户/取消/截止时间与 rollout authority 是宿主约束，不交给替换模块或请求选择。translator 不能扩大原生 allowlist；provider、plan、audit、完整 stream 在 Artifact 提交前校验。替换模块为受信任的宿主代码，不是 Python 沙箱；持久后端的事务与拒绝后补偿要在目标验收。

198 条真实本机 UDS 测试覆盖六类模块独立替换和组合替换，各重放 20 个 fixture，比较输出、三阶段 stream、audit、Artifact/evidence；包含重复请求、模块拒绝/异常、零 Artifact 与重建恢复、原生权限不可扩大，以及 20 个 fixture 的无兼容别名模式。另含12条异常store响应检查：宿主拒绝错误digest/ref/media/classification，不把后端已写入的内容视为可自动撤销；事务/补偿须由后端实现。可关闭的两个别名只由宿主参数控制，默认继续兼容。关闭后实际字节/hash/Artifact identity 会改变，canonical business fields 与 stream 不变；生产迁移需新宿主实例和独立验证，不能混用旧幂等缓存。

`forks/vibe-trading/upstream-prs/20261015-atomic-replay-handoff/` 是上游固定基线的通用重复事件修复 patch。检查器从本地固定 Git 对象读取原件，在临时目录 `git apply --check` 后运行同一组测试：未修改基线预期失败2条、修复后4条通过。保存固定原件、修复原件、回归代码及日志。不得把预期失败记作现有源码失败或把 patch 称为已开启 PR。未检查最新线上分支，未修改 submodule，未发布。

## 执行

1. `node scripts/tp01-g-functional.mjs --record` 产生真实功能回执，不授予阶段 READY。
2. `node --test scripts/tp01-g-functional.test.mjs scripts/tp01-g-local-gate.test.mjs scripts/tp01-g-plan-contract.test.mjs` 验证伪造、删减、超范围、失败回滚。
3. 冻结全部源码、契约、配置和规程到 Git；清洁树上执行 `make tp01-g-assess-local`。需要失败后重试时给记录器传入新的 `.../tp01-g-local-20261015/attempt-NN`。
4. 记录器对全部必需命令实际执行，保存输出与输入哈希；备份并恢复历史组件 canonical 原件，失败也保留日志。只有完整成功并验证内容才发布 G manifest；写入/后验失败恢复计划和 manifest。
5. `make tp01-g-local-check` 复验当前内容。`make tp01-g-release-check` 在目标/正式证据未具备时必须拒绝。

数据库/外部/部署/持续窗口/性能/同SHA hosted CI 均留 RELEASE-GATE:BETA，未执行保持 NOT_RUN。继承 E/F 目标义务与22组共享前置，不用本机 UDS、合成fixture或离线patch替代。`formalAccepted=false`、`externalPublished=false`、`upstreamAccepted=false`。正式多角色验收按统一规程由 ProjectUser 一人确认，本轮不自签。
