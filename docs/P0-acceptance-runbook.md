# P0 阶段核验与正式同提交验收规程

当前规则以[执行计划第 2.1 节](./SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#21-统一阶段与依赖消费规则)为准。P0 的 DEVELOPMENT READY 只放行 A1 功能开发；通过 `pnpm check:provider-a1` 递归核验 P0 与前置的功能输入清单、日志及依赖证据。受检输入变化后重评相关范围，单纯文档变化不要求重跑全部真实环境。

`check:development-plans` 仅检查排期结构；`pnpm check:p0` 仍检查当前 HEAD 的正式同 SHA 回执，缺少回执时返回 FAIL，不代表阶段 READY 自动失效，也不能将 READY 解释为正式 ACCEPTED。以下提交、目标重放和 notes 操作仅用于独立的正式验收声明；正式 G0、全量 provider、页面及 RELEASE 各自评估。

## 提交与回执

先提交全部实现和测试，再从该完整SHA导出干净副本重放`scripts/p0-required-checks.json`的39项检查以及`p0-contract-execution-negative.mjs`的七项反证。日志压缩内容与SHA-256嵌入回执，拒绝缺项、旧SHA、失败结果、损坏日志及不可访问的外部URL占位。

在已配置、已确认用途的 Supabase 测试项目执行目标重放，当前 runner 自动为每一步配置仓库外证据目录中的独立 `QUANTOS_TRACE_EXPORT_PATH`。该脚本仅用于当前已完成角色/身份配置的测试目标，沿用`.env.local`，不创建项目、数据库、角色或身份，不重置schema。Runtime沿用既有身份烟测的临时Storage key路径，不执行Storage操作；数据库测试使用可清理fixture或回滚事务。不要将此规程直接用于生产或未确认的新目标。所有实际测试均直接连接配置的Supabase，不使用本地数据库。

全部目标检查通过后，将生成的v2 F06回执写入该SHA的`refs/notes/f06-acceptance`，再将P0回执写入`refs/notes/p0-acceptance`。`make f06-acceptance-gate`与`pnpm check:p0`必须在干净工作树通过。P0回执包括16个控制点、六PRE执行命令、环境、三项问题关闭、七项拒绝反证及完整日志摘要；记录的审核身份是本轮用户授权的工程验证，不伪造组织owner签字。

## 文档登记与后续变更

为避免“提交内嵌自身SHA”的循环，实际回执放在Git notes。计划JSON登记最近一个已通过的完整SHA及入库历史证明；新 HEAD 若需声明正式验收，须重新取得 F06 与 P0 notes；`check:p0` 只接受当前 HEAD，历史登记不具有替代效力。文档提交本身不触发正式验收重跑；DEVELOPMENT 依据有效功能输入摘要评估。

分支提交与notes分别保存。GitHub Desktop推送分支不保证同步notes；交付给其他验收者时须另行同步这两个ref。提交与 notes 按授权分别保存，本规程不自动推送。

## 重放命令顺序

以下从干净、已提交的仓库根目录执行，先启用锁定的 Node/pnpm；每个新 SHA 使用全新证据目录，避免覆盖历史。`WEB_EVIDENCE`、`TARGET_EVIDENCE` 均为操作者指定的仓库外绝对路径。

```sh
python3 scripts/p0-replay.py "$WEB_EVIDENCE"
# 从 commands.json 的 workspace 字段读取刚导出的临时源码路径。
node scripts/p0-contract-execution-negative.mjs "$REPLAY_WORKSPACE" "$WEB_EVIDENCE"
node scripts/run-p0-f06-target.mjs "$TARGET_EVIDENCE"
node scripts/record-p0-receipts.mjs "$WEB_EVIDENCE" "$TARGET_EVIDENCE"
make f06-acceptance-gate
pnpm check:p0
```

记录器先验证完整结果与日志，再追加两个 notes；已有同 SHA note 时拒绝覆盖。失败时保留证据，修复配置或源码后使用新目录重跑；源码变更须先生成新提交。共享 notes 时分别处理 `refs/notes/f06-acceptance` 与 `refs/notes/p0-acceptance`。

冻结离线安装要求本机缓存完整。缺包时保留失败日志，可在独立副本中按原锁文件联网补齐后重放；不得把依赖准备失败记录成验收成功。
