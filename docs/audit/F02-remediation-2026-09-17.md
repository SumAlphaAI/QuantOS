# F02 整改与复验记录

> 日期：2026-09-17。基线：[F02 全面复审报告](./F02-comprehensive-review-2026-09-17.md)，原审计源码 `daf81d2f057c6b0c2d8c368f0c2b3930de91c704`。
> 状态：本地修复验证进行中；远程 CI/主干正式制品验收仍为 `NOT RUN / NO RECEIPT`。

## 一、任务完成概况

本轮按原 12 个问题补齐真实 secret 扫描、数据库重建及权限隔离、迁移内容与目录漂移、全量许可证/SCA、到期豁免裁决、Proto 历史基线、完整运行时打包和下载验签入口。用户分别批准精确版本 LGPL 构建工具的有条件准入，以及 Python 3.12 基线升级。未新增漏洞豁免、未使用生产凭据、未推送或发布。

最终提交和验证结果见本报告完成后的证据统计；未完成的远程验收不计为已关闭。

## 二、逐项整改明细

| ID | 原等级 | 模块 | 修复内容 | 验证方式 |
|---|---|---|---|---|
| A01 | 高危 | Secret | 加载默认规则、固定 Gitleaks 8.28.0 并校验下载 SHA；历史合成 JWT 只豁免精确 commit/path/rule/line 指纹 | Git 历史扫描；正常 fixture 通过，真实扫描器拒绝合成 GitHub/Slack token |
| A02 | 高危 | RLS | 逐迁移跟踪 ENABLE/FORCE/policy 最终状态；索引不能充当策略 | 静态正负对照及 PostgreSQL 目录检查 |
| A03 | 高危 | CI/数据库 | 必跑临时 PostgreSQL、两个独立重建库、双用户双租户、匿名与写入拒绝 | 独立本地 PostgreSQL 17.10 执行全部迁移及权限测试 |
| A04 | 高危 | Drift | ledger 保存 SQL SHA；真实 tables/columns/constraints/indexes/policies/routines/triggers 对照；禁止同库 URL 别名自比较 | SQL 内容、列、索引、RLS 变异及恢复验证 |
| A05 | 高危 | 制品 | 收集全部 Rust、Python、一期 Web 输出；manifest 绑定全部文件与 SBOM；独立下载 job 验签验完整性 | 包完整性、错误 SHA、缺失、多余、篡改及 Web 原生文件拒绝 |
| A06 | 高危 | 漏洞依赖 | Next 15.5.24、sharp 0.35.4；补充修复 dev/build 与 Rust/Python 扫描发现的漏洞 | 三生态原始扫描与统一裁决 |
| A07 | 中危 | 许可证 | pnpm 全锁文件；Python 所有激活依赖组；SPDX AND/OR 语义；未知许可证拒绝 | 完整清单、精确许可文件 hash、条件审批与打包限制 |
| A08 | 中危 | Proto | PR base SHA、push before SHA；同 HEAD/空基线失败 | 独立 Git fixture 删除字段后 Buf breaking 拒绝，恢复后通过 |
| A09 | 中危 | 豁免 | 三扫描器统一按生态/包/版本/漏洞/期限裁决；工具故障不可豁免 | 精确匹配、错误版本、错误 ID、过期与无效日期测试 |
| A10 | 中危 | 负向测试 | 先正常对照，再明确诊断拒绝，恢复后通过；真实 Gitleaks/Buf/PostgreSQL | F01 16 项 + F02 8 项；DB 另有真实变异测试 |
| A11 | 中危 | 外部验收 | 增加下载制品复验和带 SHA/run URL 的机器回执；本地执行覆盖率与浏览器 | 仍需远程运行、主干正式签名、required checks；5 个平台视觉基线缺口 |
| A12 | 中危 | 扫描范围 | Node 移除 prod-only；Python 运行/dev/build/security 均扫描；Rust 保留 dev | 完整锁文件范围扫描 |

## 三、问题与风险边界

- A11 仍开放。未执行远程 push、主干签名、制品下载或分支保护设置验证。CI 源码存在不等于实际跑通。
- Firefox/WebKit 5 项现有视觉测试因缺基线跳过；功能测试通过也不代表真实 Safari 发布验收。
- 旧数据库 ledger 缺少 SHA 时拒绝；不得以当前 SQL 自动补写而冒充历史证据。迁移流程见 [运行手册](../runbooks/f02-supply-chain.md)。
- 本地数据库是独立 PostgreSQL + 最小 Supabase auth fixture；不是托管 Supabase 实例回执。
- LGPL 仅适用批准的精确构建包版本；发布包禁止 Web 原生模块。切换动态图片服务器或升级相关版本必须重新审查。
- Python 升级后，F01 原 3.9 冷启动回执只适用原源码；不将旧回执重新标注为本次提交的验收。

## 四、后续整改与验收

1. 完成本地源码、测试、制品签验的 Git 提交及绑定源码的证据归档。
2. 取得推送授权后在远程运行 PR/main 全门禁，取得同 SHA 的成功运行、覆盖率、兼容矩阵及下载复验回执。
3. 补齐缺失平台视觉基线、核对 required checks 和主干签名配置；证据齐全后复审 A11，再决定 F02 整体验收。
