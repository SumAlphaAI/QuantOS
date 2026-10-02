# PRE-05 整改与验证记录

> 日期：2026-10-02；范围：一期Web环境方案。
> 源码基线：`16f34747c1b6232a0b2ef10ee15c04383f6f846c`加本轮修复；输入摘要见[证据清单](./evidence/pre05-remediation-20261002/manifest.json)。
> 结论：**PASS（仓库工程范围）**；9/9原问题关闭，16/16控制点通过，严格完成率100%；当前各级未解决问题均为0。

## 一、逐项修复

| 原问题 | 修复 | 关闭验证 |
|---|---|---|
| H-01 | 输入与客户端产物共享已知凭据指纹；两应用build及CI执行产物扫描，另对显式注入的服务器秘密检查原值/JSON与URL编码形式；诊断不回显秘密 | 合成token输入拒绝；绕过输入层写入JS/HTML/map等产物后扫描拒绝；正常公开配置构建通过 |
| M-01 | 所有公开变量拒绝首尾空白，避免trim后校验却消费原值；非法值错误不回显内容 | padded flag/profile/mode/URL单元回归及真实构建拒绝 |
| M-02 | 任一profile观测开时DSN必填；任何已配置DSN都校验HTTPS、公共用户名、数字项目路径及无密码/query/fragment | 三profile缺/坏DSN均拒绝，正常公共DSN通过 |
| M-03 | callback原值精确匹配；当前IdP只允许根路径origin，未支持路径型issuer启动前拒绝，开发说明登记后续承接 | 尾斜杠/路径issuer配置及构建拒绝；正常配置通过 |
| M-04 | 修正普通dev说明：无应用MSW worker，登录会访问占位issuer；Playwright route仅测试生效；完整mock/真实provider由UI-102、BFF-FE-001等后续任务承接 | 模板、指南、总结与真实认证函数/测试接线对照 |
| M-05 | CLI服务器入口复用Next同版本@next/env；每个文件在空环境独立进程解析，隔离缓存/宿主环境；文件语义和实际Next覆盖优先级分别说明 | 注释/引号/多行/export/变量展开/环境隔离回归及与Next实际解析对比 |
| M-06 | 独立绑定三个模板文件profile身份；staging四角色占位身份逐项校验；Web模板拒绝非审核服务器变量 | profile退化、身份删除/改名、服务器变量混入均拒绝 |
| M-07 | 总结重写为当前三Web配置、实际启动接线/测试、产物扫描与历史G0边界；计划3.9同步，历史验收不修改 | 文档/链接/历史摘要检查 |
| L-01 | CLI统一resolve：绝对路径直接使用，相对路径按仓库根解析 | 同文件两种路径通过，不存在文件非零 |

## 二、验证统计

从精确基线归档并覆盖本轮改动，开始无node_modules/构建缓存；冻结离线安装使用宿主下载缓存。Node 24.12.0、pnpm 10.20.0。最终重放见[commands.json](./evidence/pre05-remediation-20261002/commands.json)，32次执行全部符合预期：26次退出0、6次按预期拒绝。首次跨包导入兼容失败另存attempt-1，修复后重新完整重放；不混入最终通过统计。

| 验证组 | 结果 |
|---|---|
| PRE-05配置/CLI与回归 | 三模板通过；25/25配置、8/8产物/CLI回归 |
| workspace lint/typecheck/单测 | PASS；25文件、180/180（contract另计） |
| contract及关联门禁 | 13/13；计划/22项计划回归、PRE-01/02/04/06、OpenAPI/生成/覆盖通过 |
| 三profile × 两Web应用 | 6/6静态构建及每profile客户端产物扫描通过 |
| PRE-03 Web本地检查 | PASS；当前修复源码/有效配置与产物绑定，2项构建路由检查；不等于远端/全浏览器验收 |
| 实际启动拒绝 | 两应用缺变量build及dev均退出1；Terminal合成token、padded mock、路径issuer、callback尾斜杠build均拒绝 |
| 原始配置探针 | 14个符合当前决策；误放行0。路径issuer按本次明确的“不支持根外路径”决策调整为应拒绝，其余探针保持原判定 |
| 集合与身份破坏 | 两模板退化或删除四身份，CLI和测试均非零；原文件恢复 |
| 绕过输入层的真实产物注入 | 两应用现有out中的JS/HTML/map分别注入纯合成token，6/6扫描拒绝；移除后干净产物通过 |
| Next解析/脚本检查 | 同一带行内注释文件两解析结果完全一致且均通过；3个修改脚本专项lint 0错误/0警告 |

[补充执行记录](./evidence/pre05-remediation-20261002/supplement-commands.json)、[dev启动记录](./evidence/pre05-remediation-20261002/startup-commands.json)、[配置探针](./evidence/pre05-remediation-20261002/probes.json)、[字段解析对比](./evidence/pre05-remediation-20261002/parser-comparison.json)、[逐项关闭与控制矩阵](./evidence/pre05-remediation-20261002/closure.json)均已归档。[原初审](./PRE-05-comprehensive-review-history-2026-10-02.md)与[原始证据](./evidence/pre05-review-20261002/manifest.json)保留修复前身份。所有秘密探针均为纯合成值，诊断不回显令牌。

当前三类必需产物均通过；16个初审控制点全部PASS，PARTIAL/FAIL均0。此完成率只表示一期Web环境配置/仓库防线完成，不代表后续页面或全部provider实现。

## 三、验收边界

真实staging DNS/TLS/BFF/IdP/Sentry/账号、数据库执行、远端CI、正式G0、指定模型、完整浏览器/业务与Desktop验收仍NOT RUN / NO RECEIPT。普通local-mock配置不等于全部mock业务实现；指纹/产物检查不能替代受控秘密管理和目标发布审核。本轮没有数据库操作或本地数据库服务。
