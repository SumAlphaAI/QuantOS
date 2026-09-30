# GitHub 依赖告警原因与修复

日期：2026-09-30。基线：`7caa594fd9a9eb5cb2caa2b04ce48497d48cf4bc`。本轮已修复原 5 个中危告警的源码依赖，并补齐扫描缺口；当前 GitHub 新增的 fast-uri 高危与本轮 npm 审计发现的 brace-expansion 漏洞也已修复。本结论是本地修复验证，GitHub 告警状态需在提交进入默认分支并重扫后核对。

## 告警明细与整改

| GitHub 编号 | 模块与实际来源 | 风险及原因 | 修复 |
|---|---|---|---|
| #1 | Desktop Cargo.lock；Tauri → GTK 3 → glib 0.18.5 | VariantStrIter 向 C variadic 函数传入不可变 out-pointer，优化构建可产生未定义行为/空指针崩溃 | 移植上游两行修复，通过 Cargo path patch 接入；完整源码库存/哈希、manifest/lock 校验及优化 C ABI 回归 |
| #2、#5 | root package.json、pnpm-lock.yaml 的 vitest 3.2.6 | mock redirect 目标未检查文件访问边界，特定开发服务器配置下可读取本地文件 | vitest 和 coverage-v8 同步升级到 4.1.11；两个位置同一直接依赖被分别计数 |
| #4 | vitest → @vitest/mocker 3.2.6 | 与上述 Vitest 相同漏洞的另一个受影响包 | 随 vitest 升到 4.1.11 |
| #3 | UI Storybook addon-actions → uuid 9.0.1 | v3/v5/v6 使用调用方 buffer 时缺少边界检查 | 仅对 uuid@9 分支覆盖为兼容 CommonJS 的 11.1.1 |
| #6（新增，高危） | AJV → fast-uri 3.1.6 | URI authority 不闭合方括号可导致 host 判断混淆 | 升至 3.1.8，一并修复 3.1.7 之后的另一个中危公告 |
| npm 审计补充 | eslint/coverage 的 brace-expansion 1/2/5 分支 | 近期高危及中危公告，旧 override 已不再满足安全版本范围 | 分别锁定 1.1.21、2.1.7、5.0.12 |

原“5 个中危”是 **3 类漏洞、5 条 manifest/package 告警**。当前 GitHub 快照为 5 个中危及新增 1 个高危；npm 数据库还覆盖其他近期公告，因此不能只按旧推送提示修五条。

公告来源：[Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)、[uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq)、[fast-uri](https://github.com/advisories/GHSA-58mr-gqgx-xq4g)、[GLib / RustSec](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)、[GLib 上游修复](https://github.com/gtk-rs/gtk-rs-core/pull/1343)。补充公告及版本范围见修复前 npm JSON。

## CI 通过而 GitHub 报警的原因

1. 原 npm 适配器只把 high/critical 放入 findings。中危被丢弃，导致 PASS/空 findings 不能表示没有中危漏洞。本轮删除级别过滤，所有扫描发现均进入精确豁免裁决。
2. 主 Rust workspace 显式排除 Desktop；原 cargo-deny 只扫描根 Cargo.lock，未检查独立 Desktop 锁文件。本轮默认 SCA 加入 `cargo-desktop`，仍保持 F02 原回执文件名，避免破坏验签/下载消费者。
3. cargo-deny 对第三方 unsoundness 默认仅警告；本轮设置 `unsound = "all"`，对完整依赖图拦截。
4. GitHub、npm、RustSec 的公告范围和更新时点不同；旧 SHA 的历史绿色回执不能代替今天对当前依赖的扫描。2026-09-30 npm 实测还发现 fast-uri 与 brace-expansion 的新增公告。

## GLib 修复及阶段边界

Tauri 的 GTK 3 要求 glib 0.18，不能直接替换为 glib 0.20。官方 0.18.6 未发布，因此采用官方 0.18.5 源码回补。已核对原 crate archive 校验和，相对官方包唯一修改是 `src/variant_iter.rs` 的可变指针声明和 `&mut p`。保留真实版本、MIT 许可证和版权记录，没有修改漏洞豁免或 ignore 列表。完整来源见 [回补说明](../../third_party/rust/README.md)。

本地 C ABI fixture 对真实 vendored 迭代器运行 opt-level=3 回归，覆盖 next、next_back、nth、nth_back、last。该证明针对本漏洞的指针语义，不表示已完成 Linux 原生 GTK/Tauri 验收。GitHub 若仍按版本而未识别 path 回补，应提供回补证据复核，不能将其当作官方 0.20 升级。

新增 Desktop 扫描另发现六条 `unmaintained` 通知：proc-macro-error 和五个 unic 包。它们属于二期 Tauri 上游维护信息，不是本轮六条 GitHub 漏洞告警。Desktop 对此类通知采用 warning 并写入回执；vulnerability、unsoundness、yanked 和扫描器故障继续 fail closed。主 workspace 原维护策略保持不变。二期需评估 Tauri/GTK 上游迁移；详见 validation.json 的维护清单。

## 验证结果

- npm audit：修复前 moderate=7、high=8（扫描命中计数），修复后所有级别均为 0。
- 统一 SCA：npm、PyPI、主 Rust、Desktop Rust 四项 PASS；RustSec 缓存为 2026-09-30 最新提交。网络下载停滞后使用 crates.io 官方端点补齐包并校验 Cargo.lock SHA256，Rust 扫描采用该缓存离线运行。
- GLib 回归：3/3，包括优化 C ABI、源码/锁回退拒绝、独立 manifest 调用与扫描失败拒绝；SCA 负向及精确豁免：2/2。
- pnpm workspace 单元测试、类型检查、lint、前端完整构建通过；构建使用 Frontend Baseline 的公开 local-mock 配置。
- Vitest 4 移除 `coverage.all`，AST 覆盖率算法更严格。保留原 `.ts` 逻辑范围与 80% 门槛，纳入已有 TSX 和 BFF 契约测试，并补设置/审计的认证请求、版本/CSRF/撤销头与完整响应契约回归。最终 24 文件、168 测试、行覆盖率 80.21%。
- 主与 Desktop pnpm 锁文件 frozen 检查均通过；Desktop 锁文件同步安全依赖，不将 Desktop 加回一期 workspace。Desktop Cargo 全平台 locked metadata 确认只解析到本地回补 GLib。Storybook 实际构建通过，验证 uuid 升级兼容性。

证据：[验证摘要](./evidence/dependency-alerts-2026-09-30/validation.json)、[GitHub 原始快照](./evidence/dependency-alerts-2026-09-30/dependabot-before.json)、[统一 SCA](./evidence/dependency-alerts-2026-09-30/local-sca.json)、[修复前 npm](./evidence/dependency-alerts-2026-09-30/npm-audit-before.json)、[修复后 npm](./evidence/dependency-alerts-2026-09-30/npm-audit-after.json)。这些提交内证据是提交前工作树验证，明确保留 dirty=true 与基线 SHA，不冒充新提交的远端 CI/main 回执。

后续：将修复提交合入 main 后重新核对 Dependabot 状态及新 SHA 的 CI；本轮不重新关闭 F0/main 总 Gate。
