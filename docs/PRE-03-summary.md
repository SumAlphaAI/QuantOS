# PRE-03 执行总结与验收自检

> 更新时间：2026-10-02；范围：P0，一期官网与 Web Terminal

## 工程产出

- [运行时 ADR](./adr/20260814-pre03-runtime-stack.md)冻结现行 Next 15.5.24、React 19.2.8、Node 24.12.0、pnpm 10.20.0，以及测试/组件依赖；pnpm frozen 安装保证声明与锁一致。
- 官网、Terminal 独立 Next App Router 静态导出；build 生成来源摘要和实际配置/build ID 回执。默认 PRE-03 Gate 仅覆盖一期 Web。
- `pnpm check:pre03` / `check:pre03:web` 逐应用隔离读取最终生效配置和公开环境变量，验证29项关键依赖、ADR、完整workspace importer/精确链接目标/overrides及声明/锁/解析图、构建来源及两目标路由资源与 Chromium 渲染；`pnpm test:pre03` 为相应正负回归。
- 两应用 `start` 提供静态产物预览，官网3000、Terminal3100；未知资源/路由真实404。构建前复制 `env/local-mock.env.example` 到两个应用 `.env.local`，或注入同一公开变量 profile。构建和检查使用相同 profile。
- Frontend Baseline 保留计划字段/依赖/顺序门禁，预先安装 Chromium，在两个构建后执行 PRE-03 正负检查。
- React Testing Library + jsdom 直接声明于 UI 包，实际状态/交互回归已纳入 workspace test；Next 专项 ESLint 规则及负向违规检查纳入验收。

## 证据与状态

[PRE-03 全面复审报告](./audit/PRE-03-comprehensive-review-2026-10-02.md)为当前验收入口：10/10问题关闭、15/15控制点通过；详见[本轮证据清单](./audit/evidence/pre03-recheck-20261002/manifest.json)。[初审历史](./audit/PRE-03-comprehensive-review-history-2026-10-02.md)与[首轮整改记录](./audit/PRE-03-remediation-2026-10-02.md)独立保留。原[2026-09-16验收](./audit/PRE-03-acceptance-evidence-2026-09-16.md)属于其历史 SHA，不能替代当前版本的检查结果。

干净 workspace 的时限验证必须说明下载缓存、工具链和 profile 条件。仓库通过不等于 GitHub 实际 CI、正式 G0、指定模型或 provider/staging 验收。

## 第二期边界

Desktop/native 归独立第二期计划；`check:pre03:desktop` / `test:pre03:desktop` 保留显式参考门禁，默认 Web 流程不读取 Desktop 配置或源文件。依赖安装不表示后续页面的 Query、图表、表单、i18n 与真实 BFF 业务接线已经全部完成。
