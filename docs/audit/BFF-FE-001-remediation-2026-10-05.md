# BFF-FE-001 问题整改与复验记录（2026-10-05）

原始复审：[检查报告](BFF-FE-001-comprehensive-review-2026-10-05.md)。保留原报告、6 项 OPEN 发现、失败及反证证据；本文件登记修复后的状态，不改写历史。

## 一、整改范围与状态

本轮按 H-01 → H-02 → M-01 → M-02 → M-03 → M-04 处理。仅评估 A2 身份、会话与 Web 设置 API 的 DEVELOPMENT 范围；PROVIDER:A2/ALL、G1、Desktop、staging、远程同 SHA CI 与 RELEASE 人工确认分别验收。

修复源代码已形成，最终目标及上游回执刷新完成前，本文件不登记任务 READY 或六项全部 CLOSED。最终状态和统计将在证据收口后更新。

## 二、逐项修复及验证

| ID | 修复内容 | 复验标准 / 证据 |
|---|---|---|
| H-01 | 主体锁内重新读取 Supabase 因素；已有任一已验证因素时 first_factor 不允许新增；已完成命令重放与既有因素的待完成恢复保留；当前 verified 状态覆盖取消检查点 | 双会话真实负向、新注册命令未创建、因素数量不增加；原 key 重放、已有因素恢复；缺省因素兼容与畸形因素拒绝 |
| H-02 | 实际 live 路径使用独立策略单元，进入执行语义门禁；增加实际策略的 5 项 mutation，保留 reference 3 项；严格阶段门禁同时绑定 live handlers 与真实目标证明 | 14 Rust 单元断言通过（另 1 项目标测试默认 ignored）；reference 12 项；8 项 mutation 均由业务断言拒绝 |
| M-01 | 资料/偏好命令持久保存私有 correlation；响应去除私有字段；重放沿用；MFA verify、reauth 的 audit/响应/trace 用同一 ID；会话/设备撤销事件沿用命令 ID | 真实响应 ID 查到唯一 DB audit，并查到成功 trace；重放 ID 固定；SSE correlation 与撤销命令一致 |
| M-02 | lastVerifiedAt 取 Supabase last_sign_in_at 与持久 mfa.verify 审计成功时间的最新可信值；无事实时返回不可用；保留 DateTime wire 契约并同步说明与生成物 | MFA 前主认证时间、MFA 后持久成功时间；缺事实、未来异常时间的单元约束；契约/生成漂移验证 |
| M-03 | 默认 30 秒超时覆盖响应头与 JSON body；可配置 deadline 与调用方 signal；bundle 依赖失败取消兄弟读取；写操作不自动重试，结果未知有明确错误类型 | 29 consumer 测试含停滞头/body、预取消、运行中取消、401 组失败、网络错误净化和原 key/版本/草稿恢复；既有 HTTP 409/429/503 回归保留 |
| M-04 | 新增内容绑定 A2 manifest 与严格 runner，绑定语义日志、8 项 mutation 日志、20 API 目标实测/清理/trace、递归上游 READY；CI 接线与 14 项反证 | `pnpm check:bff-fe-001:development` 与 `pnpm test:bff-fe-001:development`；陈旧源码/目标证据、缺断言、清理未核实、上游失效必须拒绝 |

安全修复先经过独立边界调查，再经过独立候选补丁复核；候选复核发现 Supabase 因素字段省略的兼容性回归，已修复并纳入测试。正常无因素用户须包含可信用户 ID；字段存在但类型错误/因素畸形仍失败关闭。

## 三、证据、执行与恢复

本轮证据目录：[bff-fe-001-remediation-20261005](evidence/bff-fe-001-remediation-20261005/)。本地无数据库测试与实际 Supabase Auth/PostgreSQL + 本机 live BFF 分开记录。凭据来自工程已有配置，不写入报告/日志。受控目标测试仅修改现有测试主体及本轮临时记录，finally 恢复资料/偏好、原因素集合并清理临时会话；追加测试审计保留。

首次目标复验在新增恢复夹具处遇到 pg JSON 参数序列化错误，原失败 receipt/trace 保留于 `live-failed-fixture`；这是测试夹具错误，未作为产品 PASS。最终证明须绑定修复后的脚本和实际 handlers/policy 输入，不沿用旧 receipt。

## 四、阶段依赖与后续边界

A2 必须消费 BFF-FE-000、CORE:F06、PROVIDER:A1 的当前有效 READY。原上游功能策略绑定全部 scripts/workflows 和 client 输入，本轮代码变更使旧回执失效，须刷新适用检查后重新登记；不只替换摘要，不把历史 COMPLETED 当 READY。

G0/FEP-0/F0 的既有人工确认和历史功能证据不因本轮修改自动迁移。当前阶段状态须明确失效范围；A2 的关闭不自动放行 PROVIDER:A2/ALL 或 G1，也不是 RELEASE 批准。
