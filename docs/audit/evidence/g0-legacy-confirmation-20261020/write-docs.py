from pathlib import Path
import json,re
D=Path('docs/audit/evidence/g0-legacy-confirmation-20261020');load=lambda p:json.loads(Path(p).read_text());pre=load(D/'precheck.json');proof=load(D/'closure-proof.json');final=load(D/'finalize-command.json');tests=load(D/'regression-command.json');assert proof['status']==final['status']==tests['status']=='PASS'
source=pre['sourceCommit'];old='docs/audit/evidence/g0-legacy-local-20261020';entries=load(Path(proof['entrypointDirectory'])/'results.json')
rows='\n'.join(f"| {e['id']} | `{' '.join(e['command'])}` | 0 | [log](../../../../{e['log']}) |" for e in entries)
(D/'summary.md').write_text(f'''# G0 / PROVIDER:ALL 确认收口

本会话原答复已保存，项目用户明确确认4154d760证据包中的G0 legacy迁移后完整稿。批准只绑定源码 `{source}`、1652项输入和范围 `{pre['g0ScopeDigest']}`；原稿与不可变工程回执按Git原字节核验，未将批准改绑到后续HEAD。

当前 **G0_LEGACY_SCOPE_LOCAL / ALL_LEGACY_REVIEW_LOCAL DEVELOPMENT READY**，工程PASS、confirmation=CONFIRMED、blockers=[]、FUNCTION_STAGE_ONLY。8项API工程映射及G0-L10-2实际移除证明仍有效，其他18项/负责人/期限与未来义务未改变。正式G0历史review_status独立NOT_STARTED；formalAccepted=false、runtimeAdmission=DENIED，完整业务联调/发布NOT_RUN。

本轮实际执行同源/原稿/回执核验、`pnpm finalize:g0-development`、8个实际工程/严格READY/CI/原ALL确认/计划入口（全部exit0，两个CI admitted=true），以及176项确认/移除边界/计划CI直接回归。只改变双回执的status、blockers、admission、confirmationState、confirmationLedgerSnapshot、confirmationLedgerSha256、freeze七类确认字段；inputs、source、16组工程checks/log/hash、artifacts、原G0/ALL引用及风险边界逐项保持。原pending回执另存、新READY入口日志独立目录，原失败和旧严格拒绝日志不覆盖。

原16组工程结果（Node323、consumer177/3skip、浏览器11、两类各单次构建）作为同一冻结源已完成证据核验，本轮未重跑。原134 API/Rust/HTTP按a045f15c原范围引用；不做全闭包、三次构建或真实目标环境验收。见[命令与结果](./commands-and-results.md)、[结构化收口证明](./closure-proof.json)和[本会话原始确认](./user-confirmation.json)。

下一可执行：FE:UI-103 / I1 当前功能复核，启动时按该任务直接前提和影响范围取证。本次不批量授予其他上游/页面READY，也未启动I1实现。真实数据库/Auth/RLS/Storage/持久恢复/数据许可/venue、完整业务UI联调、目标安全/性能/长稳/部署/同SHA CI、Beta/Live RELEASE均NOT_RUN；无生产凭据、推送或部署。
''')
(D/'commands-and-results.md').write_text(f'''# 当前确认收口命令与结果

基线4154d760，冻结工程源码 `{source}`；本轮没有修改生产代码、测试源码、契约、门禁脚本或规范工程输入。

| 命令 | 实际结果 |
|---|---|
| `node {D}/precheck.mjs` | PASS：1652输入/规范摘要EXACT_MATCH，原证据索引80文件哈希、原稿/不可变回执Git字节一致 |
| `python3 {D}/record-confirmation.py` | 实际USER_MESSAGE原文、时间、原稿SHA、范围SHA及唯一ProjectUser确认保存 |
| `pnpm finalize:g0-development` | exit0；G0与ALL DEVELOPMENT READY，8实际入口均exit0 |
| `node {D}/run-regression.mjs` | 176/176 PASS，0 failed/skip；确认、移除边界、原子发布、计划/CI直接回归 |
| `node {D}/verify-closure.mjs` | PASS：仅七类确认字段变化，工程inputs/checks/source/artifacts未改；原pending/旧日志保留 |
| `node scripts/check-development-plans.mjs` | PASS；最终2 READY / 157 NOT_ASSESSED / 0 BLOCKED，见plans.log |
| `node scripts/check-g0-records.mjs` | PASS；历史正式G0 NOT_STARTED与十项签署/逾期记录不改，见records.log |

实际入口由finalize真正执行，日志保存在原attempt内的新confirmed-entrypoints目录，原entrypoints拒绝原件未覆盖：

| 入口 | 命令 | exit | 原始日志 |
|---|---|---|---|
{rows}

新source/head接受未宣称；READY只限已确认冻结功能范围，runtime DENIED、formalAccepted=false。176是本轮新执行测试；原323 Node/177consumer/3skip/11浏览器仅按原范围核验证据，不计本轮新执行。未重跑134 API、原生服务、全仓/依赖链/三次构建；数据库/外部服务/部署/发布均NOT_RUN。
''')
report=Path('docs/audit/G0-PROVIDER-ALL-confirmation-closure-2026-10-20.md');report.write_text(f'''# G0 / PROVIDER:ALL 确认收口与 READY 评估

项目用户已直接确认G0 legacy迁移后完整稿，原文与范围摘要已保存。当前 **G0_LEGACY_SCOPE_LOCAL和ALL_LEGACY_REVIEW_LOCAL DEVELOPMENT READY**，工程PASS、确认CONFIRMED、blockers=[]；只绑定源码 `{source}` 的1652项工程输入，证据包4154d760，不宣称后来HEAD接受。formalAccepted=false、runtimeAdmission=DENIED；正式G0历史复审状态与完整联调/发布独立。

原稿/不可变工程回执Git字节、原证据索引80文件哈希和当前输入完全一致；G0-L10-2工程移除完成、既有原ALL批准独立核验。实际运行`pnpm finalize:g0-development`，8个工程/严格READY/CI/确认/计划入口全部exit0，两CI admitted=true；176项确认收口直接回归PASS。双回执只更新七类确认字段，source/inputs/16组原checks/artifacts和原G0/ALL引用均保持，旧BLOCKED与严格拒绝/失败/skip记录保留。见[摘要](./evidence/g0-legacy-confirmation-20261020/summary.md)、[原答复](./evidence/g0-legacy-confirmation-20261020/user-confirmation.json)、[收口证明](./evidence/g0-legacy-confirmation-20261020/closure-proof.json)和[命令](./evidence/g0-legacy-confirmation-20261020/commands-and-results.md)。

本轮没有生产代码、测试源码、契约或门禁工具变更，未重跑原16组功能检查或134 API/原生服务/全仓/上游Gate，不把历史PASS改绑到新源码。原Node323、consumer177/3skip、Web/mockOIDC11例仅为同一冻结源工程依据。本轮只新增实际确认和176项门禁/确认/计划直接回归。

未决义务：真实Supabase/PostgreSQL/事务/RLS、IdP/Auth/MFA/Storage、外部数据许可/时效/撤权/venue、跨实例/重启持久恢复、完整业务UI联调、目标安全/性能/容量/长稳/部署/同SHA hosted CI与Beta/Live RELEASE均NOT_RUN；本次未授予运行时交易权或正式ACCEPTED。不使用生产凭据、不推送或部署。

下一可执行任务：FE:UI-103 / I1 当前功能复核，按该任务直接前提及实际影响范围取证；本轮未启动I1或将其他任务批量置READY。
''')
header=f'> 当前确认收口（G0 / PROVIDER:ALL，2026-10-20）：项目用户确认迁移后完整稿，1652工程输入与冻结{source[:8]}一致；G0_LEGACY_SCOPE_LOCAL与ALL_LEGACY_REVIEW_LOCAL DEVELOPMENT READY。8实际入口exit0，176项确认/门禁/计划直接回归PASS；不重跑原16组/134 API或全闭包，原执行原件/失败/拒绝记录保持。仅功能阶段准入，formalAccepted=false、runtime DENIED，完整联调/发布NOT_RUN。见[报告](./audit/G0-PROVIDER-ALL-confirmation-closure-2026-10-20.md)和[本会话确认](./audit/evidence/g0-legacy-confirmation-20261020/user-confirmation.json)。下一可执行FE:UI-103 / I1当前功能复核。\n\n'
for name in ['SumAlpha-QuantOS-Development-Plan.md','SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md']:
 p=Path('docs')/name;s=p.read_text();assert not s.startswith(header);s=s.replace('> 当前工程结果（G0确认收口与legacy迁移','> 历史工程结果（G0确认收口与legacy迁移',1)
 if 'Frontend' in name:
  def update(m):
   try:v=json.loads(m[1])
   except:return m[0]
   if v.get('checkpoint_id')!='PROVIDER:ALL':return m[0]
   assert v['stage_gate']['status']=='READY';assert v['source_commit']==source
   v['evidence']=['audit/G0-PROVIDER-ALL-confirmation-closure-2026-10-20.md','audit/evidence/g0-legacy-local-20261020/provider-all.json','audit/evidence/g0-legacy-confirmation-20261020/user-confirmation.json','audit/evidence/g0-legacy-confirmation-20261020/closure-proof.json','audit/evidence/provider-all-confirmation-20261020/user-confirmation.json']
   return '```json\n'+json.dumps(v,ensure_ascii=False,indent=2)+'\n```'
  s=re.sub(r'```json\s*([\s\S]*?)```',update,s)
 p.write_text(header+s)
print('Confirmation summary/report and both plans synchronized; normative inputs not changed')
