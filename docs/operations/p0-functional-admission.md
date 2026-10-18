# P0 准备阶段功能准入

依据当前 AGENTS.md，`PREPARATION:P0` 复核六 PRE 的当前实现及 A1 输入，仅放行 A1 功能开发。现有 `check:p0`/F06 notes 的正式同 SHA、目标数据库要求保持独立。

执行 `node scripts/record-p0-functional.mjs <全新 function-attempt-NN 目录>` 前提交功能源码。记录器仅运行 `scripts/p0-functional-scope.mjs` 登记的当前功能及直接影响检查，绑定完整源码 SHA、功能文件摘要、六 PRE/P0/A1 规范输入、命令、超时和日志摘要。失败/中断保留原目录；修复源码后新提交、新 attempt，不拼接历史 READY。

本轮检查覆盖页面七态/权限/故事与owner；设计 tokens、252组对比度/安全文案/组件；Web运行时锁定配置及新构建；Proto/OpenAPI/client/MSW/字段/接口台账；三种环境与模式隔离、缺项拒绝及客户端机密扫描；fixture/四类破坏检出、关键策略覆盖、CI/视觉/预算结构，及Chromium官网/Terminal/认证PoC。只执行一轮双Web/Storybook构建，不重跑F0/F01/F03/F05/F06或Rust服务闭包。

只使用仓库公共 local-mock 模板及既有锁定依赖，环境白名单剥离调用者凭据；拒绝两个应用目录内实际 dotenv。根 `.env.local` 不读取，不执行数据库操作，不安装本地服务。浏览器认证使用测试 route 拦截的 mock IdP。服务端输出仅监听本机，不外部发布。PoC的本机构建耗时不能替代干净环境 bootstrap、正式性能或长稳指标。

`pnpm check:p0:development` 验证当前输入和已提交源码的一致性，拒绝伪造命令、空测试、日志篡改、遗漏检查、历史输入、非法路径、扩大准入或目标声明。六 PRE 在本轮消费者范围内实际测试，但独立节点及其上游不重授 READY；依赖行 `NOT_REVALIDATED/referenceOnly` 表示独立Gate未复验，不能理解为未检查六 PRE 功能。`check:development-plans`只验证形状和计划顺序，不执行功能门禁。

正式确认文稿由Codex拟定，用户实际答复前保持PENDING。完整业务联调、干净依赖安装、三浏览器跨平台矩阵、目标Supabase/OIDC/RLS、性能/长稳/部署/同SHA hosted CI分别保留INTEGRATION/RELEASE待办。`--release` 必须拒绝；未执行不能记为PASS。

源码与公共门禁输入变化会撤回受影响的旧独立READY，保留历史证据。计划状态和证据后续提交不自动重跑未受影响功能，也不把后续HEAD声称为正式验收。
