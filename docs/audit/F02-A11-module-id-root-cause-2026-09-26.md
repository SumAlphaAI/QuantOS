# F02-A11 模块 ID 漂移根因与针对性修复

> 日期：2026-09-26。根因已确认，真实字节已重现，针对性修复已通过本地正反回归。**等待修复提交的远程 Gate 和新 main 同 SHA 回执，尚未宣告 F02 全量验收。**
> 本报告更新了[前轮诊断报告](./F02-A11-reproducibility-diagnosis-2026-09-26.md)中“根因未确认”的结论。历史失败与早期未复现结果继续保留。

## 一、任务完成概况

根因是 Next.js 15.5.24 内置 Webpack 5.98.0 的短模块 ID 冲突与按遍历顺序重试分配。在原失败运行的物理目录 `/tmp/quantos-f01-kRbvPC/workspace` 下，OAuth callback 客户端入口和 UI 拼接模块的初始候选均为 `9311`，下一候选均为 `1692`。先遍历到的模块取得 `9311`，另一个取得 `1692`。遍历顺序改变便改变输出字节。

原目录从 [失败任务日志](https://github.com/SumAlphaAI/QuantOS/actions/runs/36240334483/job/108399502745) 取得。Next 的 `next-flight-client-entry-loader` 将绝对路径 URI 编码后放入模块标识的 query；Webpack 的常规相对路径处理不会处理其中的编码路径。因此更换临时目录后，碰撞条件也随之变化。这解释了此前换目录进行的数十次构建为何没有重现同一故障。

SWC 对同一输入的稳定性检查没有证明整个构建链稳定；真正变化的是压缩前模块 ID。此次不是凭连续绿色运行推断修复，而是通过已知冲突的正反重放验证。

## 二、完成情况明细与字节证明

### 2.1 真实应用重放

隔离副本使用 `6973d1bb37561cb0d7f12c9541ea9c2ca0e656f4` 的源码归档；其 `apps/`、`packages/`、package manifest 与 pnpm 锁文件和失败基线 `ac73a95a758cc95385b69e9d6f9376cef4a2af0b` 无差异。诊断钩子把客户端入口标识中的编码目录映射回历史目录，仅在 ID 分配阶段控制 UI 的遍历优先级，之后恢复原顺序。业务源文件、压缩选项和模块实现不变。

**这是显式控制条件的诊断重放，不冒充未经扰动的正式主线验收。** 四次实际 Next 构建原始日志、逐文件摘要、钩子与驱动脚本见[证据目录](./evidence/F02-A11-module-id-fix-2026-09-26/README.md)。

| 原实现次序 | UI chunk / SHA-256 | 依赖 chunk / SHA-256 |
|---|---|---|
| UI 优先 | `311-691ca851ec76d073.js` / `4240199ac3805f42122dd446059eadf3324e598001f064d19d8f7594d9e1ca4b` | `638-8b36b2d29194eede.js` / `940f2ebb8f5313035987598a5de2a75f1b2d5cd2e4771526ac8c1d0cc0431d76` |
| callback 优先 | `311-862c5158e705bd1d.js` / `a559386ac69ae769e070ef16db3e36e84589c9d3e6fbf15cddd4ca49e9d87aab` | `638-8586786afa706bd6.js` / `0306503ad09448f1510e749ec809be0d2237224ff3c5e4e33958cb585a95c468` |

四个文件的名称、大小（UI 9849 字节、依赖 chunk 26239 字节）、SHA-256 均与历史 F01 三次构建回执精确对应。重放取得的是编译器生成的真实文件；初步通过替换数字匹配摘要仅用于定位线索，不作为最终重放证明。

### 2.2 修复

Terminal 与 Website 的实际 Next 配置均设置：

- 禁用默认模块 ID 插件，使用同一个官方 `DeterministicModuleIdsPlugin`。
- `maxLength: 8`、`fixedLength: true`：固定候选空间，避免模块数量跨界后隐式改变空间。
- `failOnConflict: true`：出现冲突就令编译失败，不允许按遍历次序生成另一套成功制品。

这不是仅扩大空间来降低发生概率：**即使新空间发生冲突，构建也必须失败**。后续增长若触发冲突，需要显式调整并审查 ID 策略，不能取消该失败条件或放宽摘要比较。

### 2.3 验证统计

| 验证 | 结果 |
|---|---|
| 旧实现：真实 Webpack、相同源码、反向遍历 | ID `9311/1692` 互换；可执行 bundle 字节不同，程序结果不变 |
| 实际 Terminal 配置：两种遍历顺序 | 可执行 bundle 及模块 ID 完全相同 |
| 实际 Website 配置：两种遍历顺序 | 可执行 bundle 及模块 ID 完全相同 |
| 实际 Terminal 配置：强制八位空间冲突 | 进程非零退出，明确报 1 conflict |
| 实际 Website 配置：强制八位空间冲突 | 进程非零退出，明确报 1 conflict |
| 完整 Terminal：原历史条件、两种顺序、修复后 | **61/61 输出文件逐字节一致** |
| 原始输出留存回归 | 4/4 PASS，仍按原 Gate 拒绝不一致 |

新增 `scripts/webpack-module-ids.test.mjs` 的 **5/5** 真实编译回归接入 `make f01-check`；读取两份实际 Next 配置，不以模拟 hash 或仅检查配置文字代替编译。原先的 20 轮 Linux 盲采样在根因重现后主动停止，不把取消运行计为 PASS。

## 三、问题清单及风险分析

| 项目 | 状态 | 说明 |
|---|---|---|
| 分支保护 required checks 实际阻断与恢复 | 已关闭 | 原服务端拒绝/恢复证据继续有效 |
| Playwright 截断 Git 历史 | 已修复 | 原真实 Git/Playwright 回归保留 |
| Terminal 模块 ID 偶发漂移 | 已定位、已修复，待远程验证 | 历史字节精确重现；两份应用配置均修复；碰撞失败条件有负例 |
| 新 main 同 SHA 完整验收 | 待取得 | 必须是修复合并后的 main SHA，不拼接 PR head、临时 merge 与历史 main 回执 |

模块 ID 和 chunk 文件名会按新策略改变，属于预期制品变化。浏览器合同、视觉基线、运行时 bundle 与完整三次构建继续由现有 required checks 验证。CPU/GPU 硬隔离不在此验收范围；本修复不新增该 Gate，也不修改任何安全、签名、覆盖率或三次比较要求。

## 四、验收收尾

1. 固定修复提交，取得 PR 的 8 项 required checks 成功。
2. 通过现有 PR 合并，固定实际 main 完整 SHA，取得该 SHA 的主线 CI、F01 与其余 required checks。
3. 保存主线签名和下载复验回执，核验 `sourceCommit` 与 main SHA 严格相等。
4. 保存回执与完整性清单，更新活动报告和开发计划，再关闭 F02-A11。此前状态保持 FIX_VALIDATION。
