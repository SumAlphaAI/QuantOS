# PRE-03 整改与验证记录（2026-10-02）

**10/10 项仓库问题已修复，15/15 控制点通过，严格完成率100%。** 活动问题：阻塞0、高危0、中危0、低危0。此处 CLOSED 表示实现、接线及本地验收缺口关闭，不将本地结果解释为远端 CI、正式 G0 或 provider/staging 已运行。

源码基线为 `695c5f021aaa702f94fb82b1a17314ba8df182bd` 加本次修复快照；实际运行源文件摘要为 `3f39bf846e531bb67a5e4db2e27095c279e2797c27350c2a19648cba9758a5cf`，构建回执与当前工作区摘要一致。提交前再次核对源文件与证据摘要。日志中的 build ID 使用初始Git SHA；完整修复来源由摘要及逐文件 SHA-256 标识，不把旧 build ID 本身当作修复验收源码标识。

## 一、整改概况

按阻塞、高危、中危、低危依次实现整改，保留用户在最新提交中移除前端指定模型块的调整。前端采用 `quantos-web-task/v1` 字段结构，核心模型复审入口仍沿用原规范；任务完整性、依赖、权限/provider准入与阶段顺序门禁未删除。

最终验收从干净 Git archive 加修复快照建立 workspace，不复用 node_modules、Web/Storybook/TypeScript产物，使用既有pnpm下载缓存、Node24.12.0、pnpm10.20.0及显式 local-mock profile。Web bootstrap/lint/typecheck/test/build **30.125秒**；16条主验收命令全部退出0，合计 **54.451秒**，均低于1800秒。标准启动、404与Desktop移除隔离作为补充检查另记，不计入上述主链时长。

## 二、逐项修复与关闭依据

| ID | 模块 | 已完成修复 | 证据（位于证据目录） | 状态 |
|---|---|---|---|---|
| B-01 | 计划与校验器 | 按 695c5f0 的前端无指定模型块结构更新 schema 与字段说明；核心计划复审字段保持原约定。依赖、任务与阶段顺序校验保留。 | plans.log；plan-negative.log（22/22） | CLOSED（仓库） |
| H-01 | Next 有效配置 | 使用 Next 官方生产配置加载器取得最终配置；注释、死分支、覆盖及函数返回 standalone 均被拒绝。构建实际配置及 source digest 入回执。 | web-negative.log；source.json；web-smoke.log | CLOSED（仓库） |
| H-02 | 路由/资源/浏览器 | 目标 HTML 检查 JS/CSS，Chromium 检查渲染及页面脚本异常；缺失资源、伪 marker 空页、脚本异常与404均拒绝。 | web-negative.log；web-smoke.log；start-browser.json | CLOSED（仓库） |
| M-01 | ADR 版本 | Next 对齐实际15.5.24；29项版本逐项匹配 ADR 表、manifest与锁；ADR漂移/重复行负向验证。 | web-negative.log；web-smoke.log | CLOSED（仓库） |
| M-02 | 一期 Web 范围 | 默认 check/smoke/test 均为 Web-only；显式 Desktop 命令保留；临时移除整个 Desktop 目录后一期浏览器 Gate 仍通过。 | web-isolation.log；desktop-reference.log（3/3） | CLOSED（仓库） |
| M-03 | 负向 CI 接线 | Frontend Baseline 预装 Chromium，在构建后运行 Web 正向及 test:pre03。正负套件24/24通过。 | frontend-baseline.yml；web-negative.log | CLOSED（仓库） |
| M-04 | 依赖锁完整性 | 检查全部一期 importer 依赖集合/specifier、解析记录、快照及传递引用；frozen安装与锁一致性检查通过。 | bootstrap.log；node-lock.log；web-negative.log | CLOSED（仓库） |
| M-05 | 组件测试栈 | 直接冻结 React Testing Library16.3.0、jsdom26.1.0，真实组件点击更新状态及未知枚举回退测试通过。 | unit.log（UI19项 / 全workspace177项） | CLOSED（仓库） |
| M-06 | 静态启动入口 | 两个 start 改用仓库静态服务器，实际浏览器验证正常渲染；不存在的页面和资源返回404。伴随 Desktop 锁同步，避免共用依赖安装回归。 | website-start.log；terminal-start.log；start-browser.json；desktop-lock.log | CLOSED（仓库） |
| L-01 | Next ESLint规则 | 插件注册满足 Next 构建识别，规则仅应用于两Web应用；异步Client Component违规作为error拒绝；不再出现插件缺失警告。 | lint.log；build.log；web-negative.log | CLOSED（仓库） |

## 三、验证结果与当前控制点

- 全 workspace frozen/offline安装、lint、typecheck、build通过；25个测试文件、177项单元测试通过；Storybook可构建。
- PRE-03 Web正负套件24/24、显式Desktop参考3/3、计划负向22/22全部通过；Web Gate覆盖29个关键锁版本、2343项配置/声明/解析图/ADR检查与2个实际浏览器路由。
- Chromium目标路由3/3通过；另用两个标准start入口检查首页与command页面、无页面脚本异常、未知页面/资源404。移除Desktop工程目录后的Web Gate通过。
- PRE-01正向及32项负向、PRE-02正向及27项负向、PRE-06正向及7项负向通过。两套pnpm冻结锁检查通过；根workspace仍保持一期范围。
- source摘要排除构建、依赖、Python字节码和系统元数据缓存；回归证明缓存变化不影响摘要，真实源码变化会改变摘要。配置文件、锁、ADR与公开profile均参与构建来源绑定。

原15项控制点 C01–C15 均为 PASS：工具链/workspace、完整目标依赖、冻结安装、现行ADR、两应用PoC、专项开发规范、单元/组件文档、目标路由、错误产物拒绝、有效配置、锁一致性、CI源码接线/计划检查、时限和标准启动入口。CI的执行回执仍独立为 NOT RUN，不以接线PASS代替远端执行。

## 四、边界、证据与后续复验

[证据清单](./evidence/pre03-remediation-20261002/manifest.json)、[干净执行](./evidence/pre03-remediation-20261002/clean-run.json)、[构建来源](./evidence/pre03-remediation-20261002/source.json)、[启动浏览器](./evidence/pre03-remediation-20261002/start-browser.json)、[阶段隔离](./evidence/pre03-remediation-20261002/supplemental.json)、[跨任务检查](./evidence/pre03-remediation-20261002/cross-gates.json)。

`attempt-1`至`attempt-3`保留中间验证记录，当前结论只使用目录根部最终日志与manifest。初审证据保留历史身份，不重写其原始结果。

实际 GitHub Actions、空下载缓存首次联网安装、Firefox/WebKit、provider/staging、正式G0及指定模型均 NOT RUN；数据库与native GUI不在本轮执行范围。仅生成本地Git提交，不推送或发布。

证据目录中的 replay.py 可从仓库根重放：它新建临时干净副本，叠加当前修复文件，记录每条命令；使用当前机器pnpm路径和已有Chromium。运行会覆盖同目录日志，应先保存原证据。Desktop锁另行冻结校验。修复后可通过Git提交内容和source摘要追踪本次验证快照。
