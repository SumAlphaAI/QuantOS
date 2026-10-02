# PRE-05 执行总结与验收自检

> 日期：2026-10-02；版本：2.0；范围：一期官网与Web Terminal。
> 当前仓库整改结果见[整改记录](./audit/PRE-05-remediation-2026-10-02.md)及[证据清单](./audit/evidence/pre05-remediation-20261002/manifest.json)。历史签署不代表当前产物验收；正式G0保持独立未评审边界。

## 1. 交付物

| 要求产出 | 当前交付 |
|---|---|
| 三套Web模板 | [local-mock](../env/local-mock.env.example)、[local-integrated](../env/local-integrated.env.example)、[staging](../env/staging.env.example)；profile身份受检；staging四测试身份仅占位标识 |
| 配置校验 | [运行校验](../packages/config/src/env.ts)、[Next同源文件解析](../packages/config/src/env-file.ts)、[CLI](../packages/config/scripts/check-env.mjs)、[客户端产物扫描](../scripts/check-client-secrets.mjs)与回归 |
| 开发说明 | [环境方案](./PRE-05-environment-guide.md)：变量约束、文件与注入优先级、启动/构建、测试身份/秘密、mock与目标范围 |

## 2. 完成标准

- 两应用Next配置已调用assertEnv，缺必需变量或非法原值时拒绝；不存在“后续再接线”的遗留项。
- 公开变量使用allowlist及已知凭据指纹；构建结束后扫描实际客户端文件。诊断只记录路径/标签，不回显秘密。
- profile与业务mode独立，mock/profile绑定，默认实盘拒绝；所有profile的观测/DSN条件统一，callback精确，未支持的路径型issuer启动前明确拒绝。
- CLI使用Next相同dotenv实现，文件解析隔离；相对/绝对路径均可用。模板identity和staging测试身份清单独立受检。
- PRE-05回归为25项配置单元测试和8项CLI/产物检查（33/33）；本轮准确数量、构建与负向关闭证据以整改记录为准。

## 3. 操作与后续边界

`pnpm check:pre05`校验三模板；`pnpm test:pre05`运行配置和产物/CLI回归；两应用build自动执行产物扫描，已有产物可用`pnpm check:client-secrets`再次检查。普通local-mock dev没有注册应用MSW worker，不提供完整离线登录/全部请求拦截；认证PoC使用Playwright route，完整消费者/provider由后续任务承接。

Desktop样例为二期草案，不进入一期三profile检查。根`.env.example`为服务器远程Supabase配置，不复制成浏览器配置。测试账号口令、MFA和令牌只能由受控秘密注入，模板不表示账号已经创建或授权。

[2026-09-16回执](./audit/PRE-05-acceptance-evidence-2026-09-16.md)仅证明其历史SHA与范围。[当前G0治理记录](./gate-records/G0-current-governance.json)的checkpoint保持NOT_STARTED；2026-08-14组织确认不作为当前SHA签署。远端CI、指定模型、真实staging服务/身份/Sentry、数据库和完整业务验收均须取得独立目标回执。
