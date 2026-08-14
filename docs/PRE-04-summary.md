# PRE-04 执行总结与验收自检

> 任务：PRE-04 接口盘点（FEP-0）  状态：已纳入 G0 联合评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| 契约台账（本计划第 5 节） | C01–C17 × Query/Command/Realtime × 后端任务 × proto 覆盖 × gap × 责任人 × mock 状态；P0 页面依赖矩阵 | [PRE-04-contract-ledger.md](./PRE-04-contract-ledger.md) |
| OpenAPI gap list | GAP-00 统一基线 + GAP-01–17；G0 最低面 GAP-01/03–09 已 Closed，其余按阶段冻结 | [PRE-04-openapi-gap-list.md](./PRE-04-openapi-gap-list.md) |
| 字段字典 | 共享类型约定 + 17 个契约关键字段（名称/类型/required/权威来源） | [PRE-04-field-dictionary.md](./PRE-04-field-dictionary.md) |
| 接口责任人 | 13 类角色责任归属 + 签署事项（台账第 4 节） | 同上 |
| mock 状态 | 三类形态（手写 fixture 待迁移 / 服务级 swagger 参考 / 需新建）逐契约登记（台账第 2、5 节） | 同上 |

## 2. 完成标准自检

| 完成标准 | 结果 | 证据 |
|---|---|---|
| 对照 F03、F05–F09、R02–R04、S01–S04、X01–X06、L01–L03 盘点 | 达成 | 台账每行绑定后端任务；19 项任务能力已提取并映射到 C01–C17 |
| 对照现有 Proto/API client | 达成 | 盘点 6 个 proto 文件（17 message/14 enum/2 service）、48 个 JSON Schema、swagger 7 operation、4 组手写 InMemory backend；明确 proto 为字段事实来源、手写 backend 仅 fixture 级 |
| 每个 P0 页面有 Query/Command/Realtime 依赖 | 达成 | 17 个 P0 页面 + 全局壳全部显式登记；"无"均为已记录设计决策（如 P05 快照不可变无实时、P10 拉取式审批），非待定项 |
| 无"待开发时再定"字段 | 达成 | 字段字典全部字段四项齐备；proto 引用经逐一核查修正（source_digest/image_digest、venue+venue_kind、signer:string、captured_at/max_age 归位 proto 等） |
| OpenAPI gap list / 字段字典 / 接口责任人 / mock 状态四产出 | 达成 | 见第 1 节 |

## 3. 盘点关键发现

1. **G0 最低契约面已关闭**：BFF OpenAPI 1.0.0 覆盖 C01/C03–C09，42 operations；生成 client/schema/MSW、漂移和页面覆盖检查均已进入 CI。
2. **proto 缺口已关闭**：`TradeProposal.counter_views` 已以非破坏字段新增，Buf breaking 与重新生成漂移检查通过。
3. **手写 backend 已隔离**：四组 InMemory backend 已标记 deprecated/页面禁用，删除或生成 adapter 化按联合评审记录于 2026-08-28 前完成。
4. **无 fixture 空白区**：C01、C12–C17 共 7 个契约无任何 fixture，是 PRE-06 测试基线的优先建设面。

## 4. 遗留项

1. GAP-02/10–17 按联合评审记录的明确日期完成；对应 operationId 未回填前页面不得进入 Sprint。
2. ~~counter_views proto 增补与 Buf breaking~~ → 已完成。
3. 字段字典 bff: 页面模型字段（9 组）在 OpenAPI 发布后以生成结果为准，字典同步修订。
4. 本任务交付物并入 G0 联合评审（同 PRE-01 评审记录流程）。
