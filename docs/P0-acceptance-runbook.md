# P0 同提交验收规程

P0只放行A1。`check:development-plans`检查排期结构；`pnpm check:p0`检查当前HEAD的实际验收回执，不以COMPLETED或结构PASS代替接受。正式G0、全量provider与页面联调仍由后续Gate验收。

## 提交与回执

先提交全部实现和测试，再从该完整SHA导出干净副本重放`scripts/p0-required-checks.json`的39项检查以及`p0-contract-execution-negative.mjs`的七项反证。日志压缩内容与SHA-256嵌入回执，拒绝缺项、旧SHA、失败结果、损坏日志及不可访问的外部URL占位。

在已配置、已确认用途的Supabase测试项目执行`node scripts/run-p0-f06-target.mjs /绝对路径/仓库外证据目录`。该脚本仅用于当前已完成角色/身份配置的测试目标，沿用`.env.local`，不创建项目、数据库、角色或身份，不重置schema。Runtime沿用既有身份烟测的临时Storage key路径，不执行Storage操作；数据库测试使用可清理fixture或回滚事务。不要将此规程直接用于生产或未确认的新目标。所有实际测试均直接连接配置的Supabase，不使用本地数据库。

全部目标检查通过后，将生成的v2 F06回执写入该SHA的`refs/notes/f06-acceptance`，再将P0回执写入`refs/notes/p0-acceptance`。`make f06-acceptance-gate`与`pnpm check:p0`必须在干净工作树通过。P0回执包括16个控制点、六PRE执行命令、环境、三项问题关闭、七项拒绝反证及完整日志摘要；记录的审核身份是本轮用户授权的工程验证，不伪造组织owner签字。

## 文档登记与后续变更

为避免“提交内嵌自身SHA”的循环，实际回执放在Git notes。计划JSON登记最近一个已通过的完整SHA及入库历史证明；之后的文档提交会生成新HEAD，新HEAD必须重新取得F06与P0 notes，`check:p0`只接受当前HEAD，历史登记不具有替代效力。

分支提交与notes分别保存。GitHub Desktop推送分支不保证同步notes；交付给其他验收者时须另行同步这两个ref。本轮仅创建本地提交/notes，不自动推送。
