# 2a1fd3b1 CI 复核及修复（2026-10-30）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端复核绑定 `2a1fd3b14719b173212904bcf8fab4d7432551ce`；当前修复在 main 生成本地提交，不推送。当前输入以证据目录 source-binding.json 和包含本记录的 Git 提交绑定；日志内 sourceCommit/GITHUB_SHA 是修复前 HEAD，不代表未提交输入已经获得远端验收。

## Firefox 交互修复已在原 SHA 确认

[QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/41045035104) 的 Chromium、WebKit、Firefox jobs 均成功。从该运行的 `browser-comparison-firefox` artifact 读取官网 `website.json`：19 项均首次通过，retry=0、没有 flaky；其中「文档详情可通过鼠标展开并收起」首次通过。原修复的真实鼠标交互得到 Linux Firefox 执行证据，本轮不再修改产品页面或浏览器用例。原始 JSON 与提取结果归档，结论只属于该 SHA/运行。

## 原提交其他远端结果

9 个 push 工作流共 6 success、2 failure、1 cancelled。成功的 F03、R01、Visual Baseline、F09、Compatibility、F08 保持原范围；该 SHA 未触发 F04，未执行项不记通过。

| 工作流 | 原结果与错误 |
|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/41045035130) | FAIL：coverage 检查漏识别 endorse/authorize/retain，报告 6 个已登记操作缺少页面引用 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/41045035173) | FAIL：A1 development 校验不支持已封闭的 FeatureFlag oneOf 请求；来源/财务评审缺少示例及响应头；原生风险评审/激活历史缺响应头；激活历史不可排序/过滤的策略未显式登记。verify-download 传播前置未完成，没有改其拒绝逻辑 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/41045035314) | CANCELLED：达到原 60 分钟限额；取消前 L04 已有 10 条实际 FAILED，涉及 account_state、公共 mTLS 重启、双来源、财务及 R01 当前状态用例。失败名称见 remote-failures.json，不能仅归为超时或称整组通过 |

原 jobs、完整日志和 workflow 终态保留；失败后未抵达的步骤不记 PASS。

## 修复范围

覆盖登记的两个检查入口共享 operationNames，加入 endorse/authorize/retain 三个现有动词。仍逐项校验 160 个已发布操作、180 schemas 及 160 页面引用，缺失或未知操作仍拒绝；增加对六个受影响操作逐项删除和改名的回归。

A1 请求封闭检查递归处理引用及 oneOf/anyOf，每个分支都必须封闭，空分支、缺失引用、循环和任何开放分支均拒绝。激活历史仅对 getAssistedActivationHistory 显式承认不可变版本/hash 顺序：必须具有固定策略说明、只有 cursor/pageSize、pageSize 为 1–100，且 sort/filter 为空；其他列表原规则保留。

OpenAPI 补齐来源/财务评审的 8 个请求示例、10 个成功示例，以及这 10 个操作和原生风险评审/激活历史的 correlation/no-store 响应头。示例注明是参考形状，不是有效签名或真实授权，保持 executionAuthority=false；schema 验证及注入字段/权限升级拒绝回归通过。生成客户端与输入策略同步；组件 schema、已有请求/响应 schema、参数、安全声明和既有策略不变，线格式兼容性相对原 SHA 为 PASS、0 changes。

PRE-04 v1.15 只更新本轮 OpenAPI 解析摘要和修订元数据，字典只同步版本头。仍为 API 1.34.0、160 operations、180 schemas、1100 fields；provider/历史摘要、reviewedSourceSha=null、目标/发布状态均保留。scope-review.json 由逐对象比较生成，不改绑历史 READY。

L04 先前的跨用例串行仍保留，但未优化的 JSON/验签路径及测试端也会消耗真实有效期。为自有功能测试新增独立 owned-fixture profile（继承 dev、opt-level=1、debug-assertions=true、overflow-checks=true），准备入口以此构建 BFF 和 execution-gateway，并从 Cargo JSON 的实际 executable 路径选择宿主，缺少任一产物即失败。默认测试端也使用该 profile；显式 --profile、--profile= 或 --release 原样传递。BFF 测试手工入口保留 Cargo 默认路径，显式无效路径不回退。

不修改生产 profile、业务时钟、来源/审批有效期、就绪期限、状态码断言、并发/崩溃实验、77 个测试或 F01 的 60 分钟限额。当前编译产物确认 opt-level=1、调试断言及溢出检查均开启，BFF 还包含当前生成策略的完整字节；这属于功能测试，不是发布或性能验收。

## 本地验证

| 检查 | 当前结果 |
|---|---|
| L04 完整测试目标，--test-threads=4 | PASS：77 passed，0 failed/ignored/filtered，367.13 秒 |
| A1/PRE/覆盖/fixture/手工数据库策略拒绝回归 | PASS：145 tests，0 fail/skip；含显式测试 profile 转发 |
| 客户端及契约 Vitest | PASS：28 files、311 tests |
| A1 development | PASS；formalAccepted=false，目标/staging 未授予 |
| 覆盖、PRE-01、PRE-04、PRE-06、开发计划 | PASS；PRE-04 保留 17 contracts、17 gaps、23 P0 units、1100 fields |
| 生成物一致性、相对 2a1fd3b1 的兼容性 | PASS；兼容性 0 changes、0 corrections |
| 客户端 TypeScript 编译、修改 JS 的 ESLint、L04 Clippy、Rust fmt | PASS |
| 当前产物路径/profile/生成策略绑定、范围保留比较 | PASS |

命令与原始输出见[证据目录](evidence/ci-2a1fd3b1-20261030)。仅优化宿主、测试端仍未优化的中间尝试已主动中止（exit 130），日志保留，不能记完整通过。初次 ESLint 的 globals/unused 错误及 OpenAPI 修改后 PRE-04 尚未刷新摘要的失败也保留；修正后对应检查通过。

## 边界与后续

没有推送、部署、启动本机数据库/容器或运行真实 Supabase 测试；F05/F07 完整 campaign、目标交易所、全仓 clean-room、P/RELEASE 验收均 `NOT_RUN`。原 Firefox 通过属于 2a1fd3b1，新提交远端 CI 为 `NOT_RUN`；用户推送后仍需检查主 CI、Frontend Baseline、完整 F01 及其后续步骤。保留原失败及取消结果，不将本地修复提升为新 SHA hosted PASS 或全局 READY。

归档使用 gzip、SHA256SUMS 和独立 path/sha256 源码绑定。提交前扫描新证据，提交后按原入口执行完整历史凭据扫描；结果在交付信息中报告，避免把提交前扫描写成最终提交后的事实。
