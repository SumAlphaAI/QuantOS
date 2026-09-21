# F04 远端视觉阻断整改

> 续检：`49e61d6` 的主 CI Chromium 27/27 通过，视觉阻断已远端关闭。主 CI 后续锁文件自检失败及修复见 [最新回执](F04-remote-acceptance-49e61d6-2026-09-21.md)。下文为修复时的记录。

## 定位结论

基线提交为 `fcc3af6`，本轮修改仅涉及 CI 配置及验收文档。

已核实同一 `b34a35286e8a9d3745146825098671880f48e53b`：

- [主 CI #100](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613742) 的 Chromium 24 passed、3 failed，差异见 [原始远端记录](F04-remote-acceptance-2026-09-21.md)。
- [Compatibility #64](https://github.com/SumAlphaAI/QuantOS/actions/runs/35518613745) 的 Chromium、Firefox、WebKit Terminal 各 27/27 通过；Chromium job `106098696332` 的 Terminal 步骤记录 27 passed (19.4s)。它使用相同代码、截图和比较阈值，未更新基线。
- `ci.yml` 仅执行 `playwright install chromium`；成功的 Compatibility 使用 `playwright install --with-deps chromium`，Linux 基线采集也使用 `--with-deps`。锁定 Playwright 1.62.1 的系统依赖清单包含 fonts-liberation、fonts-wqy-zenhei、fonts-noto-color-emoji 等字体。
- 基线采集 SHA `6179d22` 至本轮前，Terminal、UI、pnpm 锁文件、Playwright 配置与三个测试源文件无差异。

**已定位的配置缺陷是主 CI 缺少与基线采集一致的系统依赖安装。字体回退导致渲染差异是有同 SHA 对照支持的判断，具体字体归因尚未通过失败 runner 的字体清单或像素差分证实。** 原失败运行未上传实际截图；本机没有可用的 Docker/Podman Linux 环境，本轮不声称完成 Linux 复现。

## 修复内容

1. 主 CI 使用 `pnpm exec playwright install --with-deps chromium`，与成功的 Chromium Compatibility 环境安装步骤一致。
2. 浏览器运行前记录 Playwright 版本、浏览器安装信息及排序后的 `fc-list`。测试生成 JSON 报告；无论成功或失败都上传 `artifacts/browser/` 和 `test-results/`，绑定 `${github.sha}`。
3. F04 branch workflow 的 push/PR 路径过滤加入 `ci.yml`，并增加手动触发入口。修复提交经人工推送后，将同时触发主 CI 与 F04 branch，避免缺少同 SHA 回执。
4. 未替换任何截图，未更改页面实现，未放宽 `maxDiffPixelRatio: 0.005`，未跳过视觉测试。

## 本地验证

- YAML 解析及安装依赖、报告归档、F04 触发条件检查：PASS。
- `node scripts/check-visual-baselines.mjs --platform linux`：PASS，17 条 manifest entry；只证明资产完整性。
- `/opt/homebrew/bin/pnpm exec playwright test --project=chromium --grep '视觉基线|visual baselines'`：3/3 PASS，覆盖四张 Darwin 截图，运行于现有本地静态构建产物；不是 Linux 回执。
- 开发计划结构检查及 `git diff --check`：PASS。

## 待人工推送后的验收

当前只有本地配置修复，不能宣告 Linux 视觉问题已远端关闭。请按既定流程通过 GitHub Desktop 推送本修复提交，随后收集该提交完整 SHA 的：

1. QuantOS CI 中 27 项 Chromium 测试、stable `make f04-check`、后续质量及制品门禁的实际结果。
2. F04 Core Branch Coverage 的成功运行和覆盖率回执。
3. 若仍失败，下载本轮新增的 `ci-browser-comparison-<sha>`，依据字体清单与 actual/diff 精确定位剩余差异，不直接更新基线。

同 SHA 两项工作流成功前，F04 保持 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION。F02 A11 状态不因本轮配置修复改变。
