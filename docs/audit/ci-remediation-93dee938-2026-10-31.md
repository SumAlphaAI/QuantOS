# 93dee938 CI 复核及修复（2026-10-31）

状态：`PASS_LOCAL_DEPENDENCY_AND_COVERAGE_REPAIR_HOSTED_RECHECK_PENDING`。远端结果绑定 `93dee9382a6e93ce21b73f4b4070d49c8f7dd28a`；当前修复直接在 main 提交，不推送。当前输入以 source-binding.json 和包含本记录的提交绑定。本地日志的 source/sourceCommit 为修复前 HEAD，不能当作新提交的 hosted、目标或发布验收。

## 原 SHA 远端结果

8 个 push 工作流为 6 success、2 failure。F01、F03、R01、F08、F09、Compatibility 成功；该 SHA 未查询到 F04 或 Visual Baseline，F05/F07 完整 campaign 未执行，不转用其他 SHA 的结果。

| 工作流 | 原结果 |
|---|---|
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/41162618054) | clean-room 与 reproducibility 均 SUCCESS；原 clean-room 报告 PASS、1638.746 秒，仍在原 1800 秒限额内 |
| [Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/41162618010) | Chromium、Firefox、WebKit jobs 均 SUCCESS |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/41162618340) | 已通过 BFF 契约等前置，FAIL 于 Run SCA checks：npm 5 条未豁免命中；Python/Rust/Desktop Rust 扫描通过。verify-download 保持拒绝传播，未改逻辑 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/41162618214) | A2 实际语义及变异步骤已通过，FAIL 于 critical coverage：参考 BFF 启动超时；158 files 中 6 failed，测试报告 4 failed、1976 passed、6 skipped，总计 1986。不是已有覆盖率百分比断言被放宽后的通过 |

## 依赖修复

按本轮原扫描报告和上游公告更新锁定的开发/构建工具依赖：

| 原命中 | 当前修复版 | 上游依据 |
|---|---|---|
| Vite 6.4.4 | 6.4.5 | [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj)：deny 文件的查询参数绕过 |
| minimatch 3.1.5、5.1.9、9.0.9 | 11.0.1 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)：globparts 放大导致资源消耗 |
| glob 10.5.0 | 14.0.2 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)：取消后继续遍历 |

根 overrides 固定修复版本，UI 声明和 PRE-03 当前版本登记同步 Vite 6.4.5，明确新增对 6.4.4 回退的拒绝。ADR 的 2026-10-21 历史段落保留，另记本轮更新。Node、pnpm、Vitest、Storybook 和其他根直接依赖均未升级；未保留的旧传递包随新图移除，保留包的 resolution/integrity 不变。

旧 ESLint/Redocly 调用 minimatch 的方式与 11.x 默认导出不同。`patches/minimatch@11.0.1.patch` 只为两个 JavaScript 入口及其类型入口增加旧默认导出：CommonJS 仍可直接调用 matcher，同时保留 named exports；ESM 的 default 与 named minimatch 是同一函数。逐文件对照官方 npm tarball，除这四处导出适配外，安装包所有原始文件字节一致，匹配算法使用官方修复版。没有改版本号伪装升级，也没有新增漏洞豁免、降低审计等级或放宽扫描规则。

`sca-check` 新增 6 项实际依赖兼容回归：从 ESLint、Redocly、glob 的真实解析位置检查旧调用接口；检查 ESM 导出；glob 对已取消 signal 拒绝；Vite loopback dev server 对三种 raw/import 查询都拒绝读取合成 deny 文件，正常文件仍可读取。这些是实际安装包的局部验证，不扩大为完整漏洞扫描或生产安全验收。

共享工具变更同时影响显式 Desktop 配套锁。PRE-03 拒绝回归发现旧配套锁不再匹配当前 manifest，因此在仅含公开 manifest/patch 的临时目录同步 `pnpm-lock.desktop.yaml`。配套锁与主锁拥有相同的 733 个包版本/完整性、overrides 和 patches；冻结离线检查通过。没有更改 Desktop 业务、Rust 锁或第一期 workspace 范围，没有构建/运行 Desktop 或授予其验收。

## 覆盖率与单测入口

原 critical 命令直接启动 Vitest，仍可能选择默认未优化的 debug BFF；原远端多个 fep5/fep4/fep6/ui-p20 等参考进程在既有启动期限内未就绪。

公开 `coverage:critical`、`coverage:web` 现在通过已有 `test-web-with-bff.mjs` 准备当前 owned-fixture BFF，并使用 Cargo 实际 executable。原 Vitest 命令保留为内部 `:run`；Web coverage 的 critical 后续沿用相同产物环境。Frontend 后续 Unit tests 保持原四个包的筛选参数，通过同一准备入口执行。现有构建/产物/子测试错误传播与显式无效路径拒绝不变。

PRE-06 同步校验公开准备入口、instrumentation、Web 的 critical 后续及 Unit tests 接线，并加入绕过拒绝；wrapper 对两类 coverage 参数和失败传播增加回归。没有改 Vitest 两份覆盖率配置、critical 六文件清单、业务测试集合、启动/请求期限、profile 或生产 BFF。总体 lines>=80 与 critical 每文件 lines/statements/functions/branches=100 均原样保留。

## 本地结果

| 检查 | 结果 |
|---|---|
| 完整 make sca-check | PASS；npm、pypi、cargo、cargo-desktop 均 PASS、无 findings；既有 backport 验证和 Desktop maintenance warnings 保留 |
| Node 许可、主锁与配套锁冻结检查 | PASS；许可覆盖全部 733 个锁定包，包元数据完整性核对通过 |
| 依赖兼容 | 6/6 PASS；旧 CommonJS/ESM、glob 取消及真实 Vite 拒绝/正常读取控制 |
| 独立 critical coverage 公开入口 | PASS；158 files、1983 passed、3 existing skipped；与原远端的 1986 总数一致，未新增 skip |
| 主 CI Web coverage 公开入口 | PASS；186 files、2337 passed、3 existing skipped；lines 4549/4635=98.14%，原 80% 阈值不变；critical 后续同样 PASS |
| critical 六文件逐文件覆盖 | 每文件四项均 100%、计数非零；汇总 lines 170/170、statements 191/191、functions 35/35、branches 161/161 |
| Frontend 新 Unit tests 实际命令 | PASS；config 26、ui 28、website 43、Terminal 1893；四包合计 1990 passed，无 skip |
| wrapper / PRE-06 正反回归 | 33/33 PASS；包括绕过准备、取消 instrumentation、丢失 critical 后续和恢复未准备 debug 宿主的拒绝 |
| PRE-03 回归及最终构建烟测 | 40/40 PASS；官网/Terminal 当前输入构建和 client secret check 通过；Web-only 烟测 PASS，29 受控依赖、2294 contract checks、2 个实际 Chromium 路由检查 |
| 前端 lint/typecheck、修改脚本 ESLint、生成物一致性 | PASS |
| 开发计划 / PRE-06 / 手工数据库与 CI disposition 策略 | PASS；静态或 NOT_ASSESSED 不授予 READY |

保留中间非通过结果：初次 PRE-03 未提供公开 mock 环境，在测试收集前 fail-fast；补环境后，显式配套锁测试暴露旧共享版本，未将其当 PASS。同步锁后用最终输入完整重跑 40 项并重新构建/烟测。修改脚本的既有 globals/unused 静态错误通过显式 Node builtin 和等价输出整理修正，初始与最终日志分开保存。最终构建前的早期构建日志只保留原尝试，不重绑为最终来源。

## 证据与边界

[证据目录](evidence/ci-93dee938-20261031) 包含原完整失败日志、原 F02/artifact、原 F01 成功报告，当前扫描 raw/receipt、两种覆盖率输出/JSON、兼容/拒绝/构建/浏览器结果、补丁原始包元数据和范围保留比较。SHA256SUMS、gzip 及独立 path/sha256 源码绑定保持可复核；当前输入由包含本记录的提交封装，不把旧 HEAD 字段改为新 SHA 的回执。

未推送、部署、建立本机数据库/容器或连接真实 Supabase/交易所。没有运行 F05/F07 campaign、无关 Rust 全仓回归、完整新 F01 或三轮构建；Desktop 仅维护共享锁和静态契约。新提交 hosted CI、目标/发布验收均 `NOT_RUN`；原 SHA 的成功保留原范围。用户推送后应核对两个失败工作流及其后续步骤；本地 scoped PASS 不是全局 READY。提交后另执行完整历史凭据扫描，在交付信息报告结果。
