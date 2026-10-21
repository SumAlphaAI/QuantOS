# f55d48f4 远程 CI 修复（2026-10-21）

基线：`f55d48f4ee2212d8491a0bf3f6fa5072c2ca281e`。从干净 main 开始，按完整 SHA 查询到 10 次已结束运行：7 SUCCESS（含两项 TP01 定时运行）、3 FAILURE。此前的 F01 Clean Room 和 F08 Engine CI 在该 SHA 已通过。本轮修复只生成本地提交，不推送、不连接数据库、不部署。

## 远程失败与处理

| 工作流 | 同 SHA 运行 | 原始失败 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39569790162](https://github.com/SumAlphaAI/QuantOS/actions/runs/39569790162) | Critical risk branch coverage：auth/flow.ts 的 lines=98.73%、statements=97.7%、branches=94.91%，indicators.tsx 的 branches=96.87%，未满足逐文件 100%。测试断言本身 343 PASS、3 skipped。 |
| QuantOS CI | [39569790233](https://github.com/SumAlphaAI/QuantOS/actions/runs/39569790233) | 同一关键覆盖率缺口；普通 TypeScript 检查此前已有 445 PASS、3 skipped。verify-download 的 CI_RESULT=skipped 为前置失败的连带结果，依赖门禁保持不变。 |
| QuantOS Compatibility | [39569790536](https://github.com/SumAlphaAI/QuantOS/actions/runs/39569790536) | 官网 WebKit 的文档筛选恢复后点击 summary 未展开；重试成功但按现有 failOnFlakyTests 策略仍 FAIL。其余浏览器 job 通过。 |

其余 F01、F03、F08、F09、R01 与两项 TP01 结果完整保存在 remote-runs.json，仅证明基线 SHA 各自范围，不改绑为本轮候选通过。

## 覆盖率缺口

本地只运行认证/指示器相关测试并输出逐分支 V8 JSON，复现远端相同百分比。缺失路径分别是 BFF 会话建立返回非 204、BFF 建立等待期间会话 epoch 变化、有效期的空值默认分支、中文只读连接提示。

- 为 BFF 会话建立的 200/401/403/500 返回补充拒绝测试，验证仅执行 token 与会话建立两次请求，使用 credentials=include，失败不保留旧 actor、也不重试。
- 在第二次 BFF 请求真正开始后，通过真实 401 策略清除会话，再放行迟到的 204；必须拒绝迟到结果且不复活 actor。随后全新登录可以恢复，返回的会话元数据不含 token。同步点使用 Promise，不依赖睡眠或定时猜测。
- expires_in 在创建 Session 之前已被强制校验为正的有限 number，缺失值会拒绝。移除校验后已不可达的 `?? 300` 默认值，直接使用已验证字段；没有放宽身份响应校验。
- 连接指示器分别验证英文/中文的只读快照文案，以及离线时仍显示停止交易的拒绝说明。

关键覆盖率文件清单、include/exclude、逐文件 lines/statements/functions/branches=100% 阈值保持不变，无新增 coverage ignore。

## WebKit 原始证据与用例修复

下载原始 browser-comparison-webkit 工件，保留官网 trace.zip、error-context.md 和报告。trace 显示清除筛选按钮后原生 summary 点击前已有 element is not stable；点击坐标为 CSS (432,510.1)，13512.692ms 与 13644.182ms 邻近帧中视口位置明显移动，之后 details 始终没有 open 属性。据此判断为筛选替换焦点元素后，视口移动与坐标点击的时序竞争。本机原始用例重复 12 次全部通过，未声称本机重现了原失败。

筛选恢复用例改为明确 focus 原生 summary、断言焦点并以 Enter 展开，再检查 open 属性和正文可见；新增独立鼠标用例，验证初始关闭、点击展开、正文可见、再次点击收起及正文隐藏。两种输入路径都通过真实浏览器交互验证，没有用 DOM 写入 open、强制点击、任意等待或重复点击来绕过断言。

未修改官网产品代码、浏览器配置或工作流，CI 的 forbidOnly/failOnFlakyTests 保持原值；本轮实际浏览器验证显式 retries=0。Firefox 本机未重跑；基线同 SHA 的 Firefox 结果只作其原范围参考。

## 本地验证与边界

| 命令或范围 | 实际结果 |
|---|---|
| `make coverage-web` 普通 TypeScript 覆盖率 | 68 文件，451 PASS、3 skipped；lines=97.79%，满足原 80% 阈值 |
| 同命令的 `coverage:critical` | 59 测试文件，349 PASS、3 skipped；6 个关键源码文件的 170/170 lines、188/188 statements、35/35 functions、166/166 branches 全覆盖，逐文件均为 100% |
| 聚焦认证/指示器覆盖率 | 原缺口 FAIL 与最终 100% PASS 的逐分支 JSON/summary 均留存 |
| 官网 Chromium + WebKit 完整用例 | 38 PASS；0 skipped/flaky/unexpected；retries=0 |
| WebKit 两条相关流程各重复 30 次 | 60 PASS；0 skipped/flaky/unexpected；retries=0 |
| Terminal/domain-ui ESLint 与 typecheck；官网 E2E ESLint | 全部 PASS |
| 网站公开 mock 构建 | PASS；使用 CI 的完整公开配置，不含生产凭据 |
| 密钥扫描、暂存差异与证据摘要核验 | 日志及清单见本轮证据；没有新增扫描例外 |

普通和关键覆盖率各自已有的 3 个 skipped 均不计为通过，未添加 skip。首次完整关键覆盖率受沙箱禁止绑定 loopback 端口影响，参考 HTTP/SSE 服务未能就绪，该次 FAIL 原样保留；允许本机测试服务绑定后，CI 同命令通过。首次网站构建因我未传全必需公开配置而 fail-fast，补齐 CI 参数后通过，原日志保留。

[证据目录](evidence/ci-f55d48f4-20261021/)保存托管失败、原 WebKit trace/相邻帧、初次尝试、本地实际输出、覆盖率 JSON、浏览器报告和源码/证据 SHA256 清单。候选由所在 Git 提交与清单共同标识，未改写历史 READY 或验收记录。

本轮 Gate：PASS_LOCAL_SCOPED。新提交 hostedCandidateGate=NOT_RUN；完整 clean-room/reproducibility、目标 PostgreSQL/Supabase、部署及发布验收均未在本轮执行。推送后仍须跟踪新 SHA 的远程工作流。
