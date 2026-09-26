# F02-A11 模块 ID 根因证据

详见 [根因与修复报告](../../F02-A11-module-id-root-cause-2026-09-26.md)。本目录是受控故障重放与本地修复证明，不代替后续 main 正式回执。

- `real-build-results.json`：原实现及修复后各两种顺序，共四轮真实 Terminal 构建、每轮 61 个文件的完整摘要。
- `old-*.js.txt`：真实编译器生成的两组 UI/依赖 chunk 原始字节，扩展名 txt 只用于审计存储。四个摘要与历史失败记录精确一致。
- `collision-probe.cjs.txt`、两份 `*-build-driver.py.txt`：此次隔离副本的诊断钩子与运行驱动。包含当次临时目录，用于追溯；不是生产配置。钩子只在 ID 分配前映射历史编码路径和改变 UI 优先级，分配后恢复原遍历索引。
- `module-identities.json`：碰撞分析使用的两份模块标识。将编码的源码前缀映射为原日志中的 `/tmp/quantos-f01-kRbvPC/workspace` 后，两者初始 FNV 候选均为 9311，下一候选均为 1692。
- `build-35.log` / `build-36.log`：旧实现，两种顺序产生历史两组不同字节。
- `build-37.log` / `build-38.log`：修复后，两种顺序全部文件一致。
- `regression-tests.log`：可直接在仓库重跑的 5 项真实 Webpack 回归；含加载两份实际 Next 配置和八位空间真实碰撞拒绝。
- `sha256-manifest.json`：目录文件完整性清单，排除自身。

可移植回归入口：

```sh
node --test scripts/webpack-module-ids.test.mjs
```

旧实现的正对照必须产生不同字节；新配置必须输出一致，且新空间发生真实碰撞时必须非零退出。禁用 failOnConflict 会使拒绝用例失败。没有修改历史 Gitleaks 指纹、安全豁免或三次构建比较规则。
