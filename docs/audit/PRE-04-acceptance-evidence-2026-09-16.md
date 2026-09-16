# PRE-04 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-04 接口盘点
> 验证基线：`fc1a25bb460a2d76bb9de273ea272a4e4e5053ac`
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`
> 证据边界：验证当前仓库内接口台账、OpenAPI Gap、字段字典、责任人、mock 状态和生成契约一致性；未使用生产凭据、staging 服务或外部发布授权。

## 1. 开始状态与锁文件

- 开始时 `git status --short --branch` 为 `## main...origin/main`，工作区和暂存区均为空。
- HEAD 与 `origin/main` 均为上述基线提交。
- 检查根/桌面 Cargo、Buf、pnpm、Engine uv、fork repository 与 third-party baseline 锁文件；本任务未产生锁文件差异。

## 2. 发现与修复

1. PRE-04 文档仍记录 BFF OpenAPI 1.0.0、42 operations；实际为 1.1.0、55 operations、41 schemas。
2. 文档仍记录 17 messages、14 enums；实际 6 个 Proto 文件包含 38 messages、15 enums、2 services、7 RPC，并生成 48 个 JSON Schemas。
3. mock 汇总把已有 session fixture 的 C01 和已进入 OpenAPI 1.1.0 的 C17 列入“无 fixture”，且没有区分 C02 Inventory Fixture 与冻结契约。
4. C07 台账仍声称缺少 `counter_views`，但 Proto 已完成 additive 增补；字段字典总结又把实际超过九组的页面模型错误写成“9 组”。
5. 台账、Gap、字段和 P0 页面依赖只有静态 Markdown，没有删除/漂移负向 Gate。

本次新增 `quantos-pre04/v1`：从 PRE-01 页面总台账推导 Terminal P0 集合，精确验证 17 个契约、17 个 Gap、18 个 P0 单元、144 行字段、owner/mock 状态、OpenAPI/generated manifest 和 Proto 基线，并接入 Frontend Baseline CI。

## 3. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `pnpm check:pre04` | PASS | 17 contracts；17 gaps；18 P0 units；144 field rows；55 operations；41 schemas |
| `pnpm test:pre04` | PASS | 6/6；缺 Gap、未决依赖、无权威来源、manifest 漂移和 mock 回退均被拒绝 |
| `pnpm check:bff-openapi` | PASS | OpenAPI 3.1.0；本地引用可解析；55 operationId 唯一；幂等与 SSE 参数通过 |
| `pnpm check:bff-generated` | PASS | client/schema/55-operation manifest/MSW 与 OpenAPI 无漂移 |
| `pnpm check:bff-contract-coverage` | PASS | 55 operations、41 schemas、55 页面引用双向一致 |
| `pnpm proto:check` | PASS | Buf format/lint/build/breaking、三语言生成物与 48 JSON Schemas 无漂移；公开 registry 访问经授权 |
| `pnpm lint` | PASS | 8 个 workspace 项目 |
| `pnpm typecheck` | PASS | 8 个 workspace 项目 |
| `pnpm test` | PASS | 22 个测试文件、109 个测试；SSE 用例使用本机临时回环端口 |
| `node scripts/check-development-plans.mjs --fresh-review` | PASS | `quantos-plan-review/v1` structure PASS；platform/model 均为 `NOT_RUN` |
| `bash scripts/check-lockfiles.sh` | PASS | 必需锁文件存在且本任务无锁文件差异 |

## 4. Gate 结论

- **PRE-04 repository Gate：PASS。** 四项必需产出均存在，并具备跨 PRE-01、OpenAPI、generated manifest 与 Proto 的可重放正向/负向验证。
- **PRE-04 development status：COMPLETED。** 表示接口盘点完成，不表示 Open Gap、provider 实现或 staging 集成完成。
- **P0 dependency Gate：PASS。** 17 个 Terminal P0 页面 + 全局壳的 Query/Command/Realtime 依赖全部明确；无依赖时必须记录理由。
- **Field decision Gate：PASS。** 144 行字段均具备类型、required 与权威来源；没有“待开发时再定”字段。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造 Codex 平台加载或模型结论。

## 5. 未决风险

1. GAP-02、GAP-10–16 和 GAP-17 Desktop 面仍为后续 BFF-FE 交付，不得因 PRE-04 完成而视为接口 Implemented/Integrated。
2. C17 P15/P17 仅 Contract Mocked，尚无 staging provider/consumer 签署。
3. C02 的三个 command-center 文件只是 Inventory Fixture；C03–C06、C08–C17 缺少完整专用场景数据 fixture。
4. 本次不包含生产/目标环境网络验证，未执行发布动作。

## 6. 下一可执行任务

按执行计划依赖顺序为 **PRE-05：环境方案**。开始前应保持 PRE-01–PRE-04 Gate 通过，并继续把配置源检查与真实 staging/desktop 环境验收分开记录。
