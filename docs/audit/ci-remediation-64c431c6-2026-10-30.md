# 64c431c6 CI 修复（2026-10-30）

状态：`LOCAL_SCOPED_REPAIR_FIREFOX_HOSTED_RECHECK_PENDING`。基线为 `64c431c64f7c69976d741fe5ef6b4ed22eeef72f`，在 main 修复并生成本地提交，不推送。新提交 hosted CI、真实数据库、目标交易所和发布验收保留 `NOT_RUN`。

## 原提交远端结果

该 SHA 的 10 个 push 工作流结束，6 成功、4 失败；另有 TP01 Vibe Upstream Monitor 定时运行成功。F03、F04、F08、F09、R01、Visual Baseline Candidates 的成功保留原 SHA 与范围，未查询到该 SHA 的 F05/F07 运行。

| 失败工作流 | 原错误 |
|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/41030845258) | PRE-01 API 登记仍混用 1.18.0/1.30.0，而当前 OpenAPI 为 1.34.0 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/41030841528) | clean-room 的 BFF core_l04 共 76 项，52 PASS、24 FAIL；含进程就绪 Timeout、短期来源/审批 409/422 及后续风险预期不符。reproducibility job 成功 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/41030841473) | 完整历史 Secret scan 命中 474 处；verify-download 正常传播前置未完成，未改变拒绝逻辑 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/41030841469) | Firefox 官网鼠标折叠用例第二次点击未收起，重试后被标 flaky；failOnFlakyTests 令 job 失败。该 job 其余 18 项成功，Chromium/WebKit job 成功 |

原错误日志和 jobs/运行终态保留；前端在 PRE-01 后、主 CI 在 Secret scan 后未执行的步骤不记 PASS。

## 接口登记及计数同步

PRE-01 登记更新为当前 1.34.0、160 operations，与已存在的 OpenAPI/catalog/生成物一致。除版本外，显式补入 18 个新发布操作：P08 的原生账本/估值/kill 控制，P10 的当前风险候选/新评审，P11 的共同对账读取，P13 的 C11 激活历史及来源/财务评审控制。全部按 catalog 的 C06/C08/C09/C11/C16 追踪，现有 owner 与阶段边界不变。日期仅代表当前契约/生成物复核，不代表 provider 或 staging 新验收；第 3 节历史版本记录原样保留。

继续运行直接相关 PRE-04 回归时，发现其固定字段行数仍为 946，而当前受控基线和实际字典已经是 1100 行。仅将预期计数同步为 1100，保留完整同源字典、类型、required、枚举、来源身份和缺失字段拒绝断言。没有重写旧历史验收，也没有修改 OpenAPI、catalog、业务源码或生成物。

## L04 测试资源调度

原有 76 个 L04 用例各自启动多个独立 BFF/执行进程，并保留 fsync、签名验证、30 秒来源有效窗口及真实墙钟。原日志未记录每个子进程的精确资源时序；本机一个原失败用例独立执行通过，耗时 27.23 秒，说明此路径对共享资源争用敏感。将原远端失败归因于资源压力是结合这些证据的判断，不声称复现了 Linux 当时完全相同的负载。

Lab 在任何进程、证书及短期签名输入创建之前获取用例槽；跨用例串行，自有 BFF 子进程固定两个 Tokio worker。用例内部原有并发副本、发布者 fence、IO reservation、崩溃和竞争实验全部保留。某个用例 panic 仍由原测试框架报告失败；槽的 poison 不阻止其余独立用例执行。

首次普通互斥槽尝试完成 30 项后，在同一测试创建第二个 Lab 时自锁，已中止并保留日志，不能记作整组通过。最终槽按测试线程可重入计数，最后一个 Lab 释放后才放行另一个线程；原多 Lab/12 请求用例专项通过。

新增槽回归首次使用“释放后 5 秒内指定线程应取得全局槽”的假设，整组并行调度时其他长用例可能先取得槽，故该新增测试出现一次失败。仅修正这一新增测试为在外层租约仍持有时验证计数 2→1，专项通过；不再对全局等待队列作公平性或耗时假设。CaseSlot 实现、Lab helper 及全部原有业务用例在这次新增测试修正前后逐字相同，差异单独归档。保留整组原失败，不把其 exit 101 改写为整组 PASS；按原有业务用例与修正后的新增测试分别记账，无关业务用例不因测试自身修正重复执行。

没有改生产 Tokio 配置、就绪等待期限、业务时钟、签名/会话/来源有效期，也未增加重试、ignore 或放宽状态码/拒绝断言。规程同步至 `docs/operations/phased-testing.md`；这是功能测试调度，不是并行容量或性能验收。

## 精确历史扫描登记

用原 Gitleaks 8.28.0 及原配置/入口复现 474 项；本机扫描 1070 commits、约 2.07 GB，远端为 1049 commits。逐项读取 27 个历史提交中的 Git blob，核对为：

- 458 项 `keyHash`，为 frontend-g8/native-control-network 自有请求幂等键的 SHA-256 摘要；历史生产者将 idempotency-key 做 SHA-256 后输出。
- 16 项 `key`，为 accepted/unknown 自有命令 reservation 的 UUID 幂等请求键。对应 issued 记录含 approval/receipt/subject；测试生成随机 UUID，原生提交代码将请求键存入 issued。其同名加密材料字段并未获得豁免。

核对并归档 29 份生产者源码身份。只追加 474 个精确 commit/file/rule/line fingerprint，原 ignore 保持完整字节前缀；配置、通用规则和扫描脚本未改。不是目录、字段名、任意 UUID 或任意摘要的放行。原完整历史扫描随后通过；临时 Git 历史的干净控制通过，在两条历史证据路径新增合成 API-key/keyHash 均被拒绝。

## 官网鼠标用例

保留原远端 Firefox trace：第一次点击约 14256ms，第二次约 14470ms，目标 summary 的中心点几乎相同。第二次点击没有产生期待的 closed 状态，重试也发生过失败。考虑到短时间内在同一区域连续点击可能进入浏览器原生多次点击/文字选择序列，测试改为 disclosure 区域内两个明确分离的 hit point，各执行一次真实鼠标点击；仍严格检查 open 属性和内容可见性。

这是针对输入手势的修复判断，不把原 trace 说成已经证明某个 Firefox 内核缺陷。未改产品 DOM/CSS、改用 JavaScript 属性赋值、force click、固定 sleep、键盘替代鼠标、增加重试或跳过 Firefox；原键盘展开用例保留，三个浏览器的 CI 矩阵和 failOnFlakyTests 均不变。

本机 Firefox 初次无头启动在页面测试前超时；有窗口及独立软件渲染配置也因 macOS 内容/GPU 子进程启动错误失败。保留启动日志，中止未完成的重复尝试；不把它计为交互测试 PASS。本轮本机 Firefox 交互复验为 `NOT_RUN_ENVIRONMENT_BLOCKED`，需要推送后由 Linux Firefox CI 复查。

## 本地验证

| 检查 | 结果 |
|---|---|
| PRE-01 当前入口 | 原版本不一致 FAIL；修复后 PASS，30 页、210 场景 |
| PRE-01 / PRE-04 / 手工数据库策略回归 | 初次因旧字段计数 FAIL 1；同步后 97 PASS、0 skip |
| PRE-04 当前清单 | PASS；17 contracts、17 gaps、23 P0 units、1100 fields、160 operations、180 schemas |
| BFF 生成物漂移及页面覆盖 | PASS |
| PRE-06、开发计划跨文档检查 | PASS；静态检查不代表目标环境或完整浏览器验收 |
| L04 当前 helper 业务组 | 原有 76 项全部 PASS，0 ignore；长组共 1802.17 秒。组内旧版新增调度测试 FAIL 1，exit 101 原样保留；仅修正该新增测试后，当前源码专项 PASS 1。其余 helper/业务输入逐字不变，分别记账，不称整组 exit 0 |
| L04 test target Clippy、Rust fmt | PASS |
| 修改 JavaScript/TypeScript ESLint | PASS |
| 新构建官网 Chromium / WebKit | 38 PASS、0 retry；含鼠标/键盘/搜索及 SEO；没有更新截图 |
| Firefox 本机交互 | NOT_RUN_ENVIRONMENT_BLOCKED；原远端 trace 保留 |
| 原完整历史凭据扫描、两条新命中拒绝探针 | PASS；最终提交后另以原入口复查 |
| git diff --check | PASS |

初次官网构建采用 loopback SITE_ORIGIN，但完整 E2E 默认期望 CI 公共 origin，产生两条 SEO 断言失败（其余 36 项通过）。使用 CI 的 `https://sumalpha.ai` 公开元数据重建后原 38 项全部通过；没有修改 SEO 断言，也没有向该域名部署或发送测试请求。两次构建及失败/成功日志分别保留。包管理器和浏览器启动问题均与业务拒绝分开记账。

## 证据与后续

[证据目录](evidence/ci-64c431c6-20261030) 保留远端原日志、失败 trace、历史误报逐项复核、当前测试/编译/构建结果及中间失败。gzip 无损归档，SHA256SUMS 绑定文件，source-binding.json 使用独立 path/sha256 字段绑定当前输入。

没有启动本机 PostgreSQL、Supabase 或容器，未运行真实数据库、真实交易所、F05/F07 完整 campaign、无关全仓或三轮重建。没有修改 secrets、推送或部署。用户推送本地修复提交后，需核对四个工作流及未抵达的后续步骤，尤其是 Linux Firefox；不把本地 scoped 结果改写为新 SHA 的 hosted CI 或全局 READY。
