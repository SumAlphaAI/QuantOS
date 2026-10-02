# PRE-04 执行总结与验收自检

> 任务：P0 / PRE-04 接口盘点；版本：1.2；日期：2026-10-02。
> 当前状态：仓库整改验收 PASS；16/16 控制点，9/9 原问题关闭。远端 CI、正式 G0、指定模型与目标环境未据此验收。

## 1. 当前产出

| 产出 | 当前范围与校验 |
|---|---|
| [契约台账](./PRE-04-contract-ledger.md) | 17 契约、领域任务与角色；全一期23个P0单元（17 Terminal + 5 官网 + GS），辅助风险/审计/订单依赖齐备 |
| [OpenAPI Gap](./PRE-04-openapi-gap-list.md) | 62 published/46 planned；8 Closed、2 Partial、7 Open。C04 附件与 C05 实时未发布，C17 Web 全发布；状态不是 provider/staging 验收 |
| [字段字典](./PRE-04-field-dictionary.md) | 383 行展开后的 wire/计划字段，另列共享schema；required、枚举、格式、领域→wire映射和源锚分开。计划模型不冒充已发布BFF schema |
| 接口责任人及mock | BFF TL +受控领域角色；Inventory Fixture/Contract Mocked/本地Implemented按源与证据区分，未配置MSW返回501 |
| [受控盘点基线](./PRE-04-inventory-baseline.json) | 固定源摘要、领域字段映射、后端任务/owner、逐页决策、fixture和本地provider历史证据；不是目标环境签署 |

## 2. 可执行验收

`pnpm check:pre04` 校验17/17契约和Gap的完整唯一性、所有23个P0单元、PRE-01辅助契约、页面/核心/BFF任务/角色、published/planned状态、字段字典与实际schema一致性、完整operationId/method/path、Proto与JSON Schema身份及本地实现依据。

`pnpm test:pre04` 的32项回归覆盖字段删除/假来源/类型与required漂移、同数量源替换、重复行、缺官网页、缺辅助契约、假任务/owner、错误Gap关闭、虚假mock升级、证据/fixture缺失和原生范围混入。Frontend Baseline继续调用正负Gate，并保留OpenAPI、生成漂移及PRE-01覆盖检查。

本轮完整验证见[整改记录](./audit/PRE-04-remediation-2026-10-02.md)和[证据清单](./audit/evidence/pre04-remediation-20261002/manifest.json)。[初审报告](./audit/PRE-04-comprehensive-review-history-2026-10-02.md)为修复前基线；[2026-09-16验收](./audit/PRE-04-acceptance-evidence-2026-09-16.md)仅代表其记录的历史SHA与环境。

## 3. 变更与维护

先复核OpenAPI/catalog/Proto及字段映射，再显式更新盘点基线中的版本、源摘要、角色/任务和状态依据；随后运行 `pnpm generate:pre04-fields`，重放正负Gate与BFF生成/页面覆盖/contract checks。生成命令只更新字典，不自动批准或刷新受控基线。任何源身份漂移都需review，不能只改字符串白名单使Gate变绿。

角色是责任登记，实际签署另行记录。本地Implemented只依赖已有仓库provider/测试/历史验收身份；它不等于当前真实数据库、身份、对象存储、staging或远端CI通过。全部planned operation也不因PRE-04完成而交付，后续BFF-FE任务负责冻结与实现。

## 4. 第二期边界

一期只交付官网与Web；原生P16、缓存清除、签名更新和诊断导出见[DESK-PRE-04承接表](./DESK-PRE-04-interface-transfer.md)，二期保持NOT ACCEPTED。L02是Vault/mTLS/受限执行区安全任务，原生任务由独立Desktop计划承接。
