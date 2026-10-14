# A4 / BFF-FE-006 本地接口、fixture 与必要前置预检

日期：2026-10-14。预检候选：`a9b6fba26c9b6e59e42501a9a535703829fb6532`。基线：`45bde37547419f85db56f39b5c90475e7165e3a9`。

结果：PASS_WITH_LOCAL_GAPS（预检执行通过，准入缺口未关闭）。本轮只完成预检及准入草案，不实现或放行BFF006/A4。`BFF006_LOCAL=PROPOSED_NOT_REGISTERED`，BFF006、A4、X01–X04、TP07和X3-SERVICE仍NOT_ASSESSED。现有R1/A2/BFF003/BFF005/A3/TP02六项限定DEVELOPMENT Gate保持READY；不改业务功能、公共策略或计划依赖，不将旧141组执行当作本轮重新执行。Supabase、外部环境和性能未执行，formalAccepted=false。

## 本地接口与fixture

当前C06/C07/C08/C09声明17个OpenAPI operationId，契约/生成client/schema/页面目录已存在；C13的`getOrderCapabilities`、`getTradePreflight`和`subscribeTradePreflight`仍仅规划，缺路径、schema、fixture与provider。共20组QuantOS自有静态请求/成功JSON样例（6请求、14响应）逐项与当前OpenAPI对照，另保留3个SSE的实际生命周期验收义务；不是真实行情、已退役32条事实或交易授权。

实际reference-provider路由结果：17/17个已声明业务接口返回404，均未满足成功/错误响应契约。正向session控制和未授权/完整命令体负向控制分别应为200/401/422。输入guard存在并不能证明业务handler存在；空404也不满足声明的结构化错误、no-store及correlation契约。本轮HTTP探针不签发实际命令，不调用venue。

38项专用测试包括20组样例、样例来源一致性、完整命令体/伪造actor/tenant/交易密钥字段/坏引用/缺引用/错类型/缺幂等/缺CSRF/恶意origin/bearer-only/坏审批枚举/危险排序/可执行Proposal/错误correlation/敏感输出和不得由预检授予Gate。

## 必要本地闭包与准入缺项

| 对象 | 递归节点数 | 当前结论 |
| --- | --- | --- |
| BFF006_LOCAL草案 | 64 | 唯一消费者FE:BFF-FE-006；未登记 |
| A3现有策略覆盖 | 42 | 当前六Gate仅验证现有证明继续匹配输入；未重新执行完整42节点 |
| BFF006新增节点 | 22 | 均缺专用本地策略/递归回执映射 |
| S2-SERVICE | 39 | 必要祖先，不能由绿色X领域测试替代 |
| SERVICE:TP01 | 31 | S2祖先；含TP01-E/F/G服务演进 |
| X3-SERVICE | 48 | 必须包含S2、TP12、X05及SERVICE:X06 |
| A4_LOCAL未来聚合 | 66 | 比BFF006多BFF004及A4自身；策略/回测/Release API另行闭合 |

新增22节点完整列表和各节点规范要求见[机器可读闭包](./evidence/bff-fe-006-preflight-20261014/attempt-01/inventory.json)。本轮直接前置中仅BFF003/BFF005/A3为独立READY；BFF007及X01–X04/TP07/X3其余7项直接前置NOT_ASSESSED，聚合内部证明不能授予这些上游独立Gate。

源码检查另外确认G06：`CommandIssuer::issue`的同tenant/key缓存命中位于kill switch、Release、Proposal过期和数据时效检查之前，直接返回既有Command；缓存key不包含requester，且不比较业务意图。见[源码证据](./evidence/bff-fe-006-preflight-20261014/source-replay-finding.json)。现有七类拒绝和1000并发测试不能证明重放后的拒绝/意图冲突，后续BFF不能直接依赖这条缓存路径。本轮只做源码确认，未执行漏洞利用或将其宣称为已部署接口风险。

本地准入草案见[proposed-scope.md](./evidence/bff-fe-006-preflight-20261014/proposed-scope.md)。要求服务端资源/账户/租户权限、MFA用途与对象绑定、Proposal不可执行、短期commandRef及幂等/冲突、职责分离、七类拒绝、1000并发单次签发/下游提交、Order/Fill事实和SSE恢复、取消审计及故障恢复；只准入自有合成/受控本机模块，不缩减规范依赖。

| 前置 | 本轮实际预检范围 | 仍未闭合的本地功能 |
| --- | --- | --- |
| X01 | 1万事件黄金回放、重复/乱序拒绝、重建 | 受控读模型服务与BFF消费/递归回执 |
| X02 | 各50 allow/deny/approval-required及规则结果 | 95%规则分支覆盖本轮NOT_RUN；完整输入/受控消费证明 |
| X03 | 七类拒绝、1000并发、批准签名 | 混合P95/TTL测试按用户性能移交范围跳过，TTL/短时签发应拆分独立本地测试；commandRef存取和恢复 |
| TP07 | 本机Paper与内存Nautilus outbox模型、边界/隔离/事件映射 | 真实独立本机传输与重启/错误/权限闭环；不能将内存模型当作真实Nautilus进程 |
| X04 | 10万订单状态转换、重复submit单次调用、cancel审计、Fill溯源 | 服务账本/恢复与BFF消费者 |
| X3-SERVICE | X05对账20类差异、受控时间/Shadow禁止submit、X06 UI fixture冒烟 | TP12/S2/SERVICE:X06等服务组合与递归准入；UI fixture不是服务验收 |

## 命令与结果

```sh
PATH=/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH \
  node docs/audit/evidence/bff-fe-006-preflight-20261014/run.mjs attempt-01
node docs/audit/evidence/bff-fe-006-preflight-20261014/verify.mjs attempt-01 --record
python3 docs/audit/evidence/bff-fe-006-preflight-20261014/seal.py --verify
```

完整执行命令、退出码、时间、日志及摘要见[results.json](./evidence/bff-fe-006-preflight-20261014/attempt-01/results.json)，实际路由原件见[HTTP回执](./evidence/bff-fe-006-preflight-20261014/attempt-01/http/receipt.json)。执行器清除数据库/Supabase/凭据和QUANTOS外部opt-in，采用QUANTOS_SKIP_ENV、离线Cargo/uv/npm和RELEASE_PERFORMANCE=0；reference-provider仅绑定loopback并在探针后退役进程。未建立本机PostgreSQL/Supabase/Docker环境。

| 验证 | 实际结果 |
| --- | --- |
| 预检命令组 | 16/16符合预期；其中准入/实际路由两组退出2，代表保留缺口，不是Gate PASS |
| 静态fixture与负向 | 20组样例、38/38测试PASS |
| X领域模型 | 40 PASS / 0 FAIL / 2 ignored / 1 filtered；后两类不计作PASS |
| Execution service | 4/4 PASS；Paper resolver模型，不是Supabase/Vault实际执行 |
| API client | 68/68 PASS |
| UI fixture | 9/9 PASS；不是实际BFF或SERVICE:X06组合验收 |
| 计划及移交 | 结构/跨计划顺序PASS、负向42/42 PASS、core/frontend handoff PASS |
| 候选与历史 | 833文件摘要/Git blob及64节点规范输入一致；基线25108份历史证据原字节保留 |
| 证据负向 | 8/8实际证据改写被拒绝且原字节恢复；[原件](./evidence/bff-fe-006-preflight-20261014/evidence-negatives-01/results.json)保留 |

原始失败保留：准入退出2及17个业务路由缺项不涂绿；这两项作为预检发现的已知功能缺口计入PASS_WITH_LOCAL_GAPS，不是准入通过。预检harness初次语法检查失败原件[initial-syntax-failure.log](./evidence/bff-fe-006-preflight-20261014/initial-syntax-failure.log)已保存，修复后语法及38项测试实际通过。初始日志不代表业务源码失败。

## Gate、风险与下一任务

全图维持6 READY / 153 NOT_ASSESSED / 0 BLOCKED；本轮发现的准入阻断记录在预检结果中，不直接改写任务stage_gate。BFF006/A4实现未完成，缺业务handler/C13及22节点策略；S2/X3服务准入、风险分支覆盖、独立本机Nautilus边界和恢复是后续本地功能待办，不能随外部环境一并豁免。

Supabase目标迁移/RLS/事务/Auth/Storage/Vault与目标持久恢复、真实Nautilus/venue/provider/市场来源用途、OS隔离/部署/mTLS/远程治理/SCA/同候选hosted CI、代表性容量/长稳/P95/真实10交易日Shadow及15分钟SLA等全部保持NOT_RUN，归测试/RELEASE-GATE:BETA；原阈值不降低。现有模拟十日/受控时间测试只证明本机模型语义。正式接受仍需ProjectUser确认，未自行批准，未升级订阅、未用生产凭据、未推送或执行外部发布。

下一可执行任务：先修复X03缓存重放的安全条件重验、请求人/业务意图冲突校验，并拆分TTL功能与P95性能测试，补专用负向证据；随后完成S2-SERVICE（39节点，含SERVICE:TP01的31节点闭包）本地接口/fixture与必要前置预检和映射，再闭合X3/TP07本机传输与BFF006的17+3业务接口。不以删依赖或只挂fixture路由授予READY。

变更仅包括审计目录中的预检代码、测试、fixture、准入草案、报告和原始证据，详见[变更文件](./evidence/bff-fe-006-preflight-20261014/changed-files.txt)。[验证摘要](./evidence/bff-fe-006-preflight-20261014/verification.json)与[封存摘要](./evidence/bff-fe-006-preflight-20261014/seal.json)绑定当前候选。冻结提交`a9b6fba2`；最终证据提交在完成回复报告。
