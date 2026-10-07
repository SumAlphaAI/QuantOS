import fs from 'node:fs';
import assert from 'node:assert/strict';
const {nodesFromPlans,planInput}=await import(process.cwd()+'/scripts/provider-a1-receipts.mjs');
const before=nodesFromPlans();
const root='docs/audit/evidence/ci-47cb743-remediation-20261007';
const closure=JSON.parse(fs.readFileSync(root+'/closure-verification.json'));
const confirmed=(closure.stageCounts.BLOCKED||0)===0;
const state=`${closure.stageCounts.READY} READY、${closure.stageCounts.BLOCKED||0} BLOCKED`;
const human=confirmed?'项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。':'G0 16/16、FEP-0 2/2 工程通过；当前 G0 范围 `52fee5f6e499` 尚待项目用户确认，G0/FEP-0 保持 BLOCKED。';
const full='evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007';
const identity='evidence/bff-fe-001-remediation-20261005/ci-47cb743-final-reassessment-20261007/a2.json';
const audit='evidence/bff-fe-007-remediation-20261006/ci-47cb743-reassessment-20261007/development.json';
const window='evidence/provider-a2-remediation-20261007/ci-47cb743-reassessment-20261007/provider-a2.json';
const evidence='evidence/ci-47cb743-remediation-20261007/closure-verification.json';
const currentFep0=before.get('FE:FEP-0').stage_gate.evidence[0];
const source='d00041ee354701a08fa7483e948b74f374439b13';
const fullDirectory='docs/audit/'+full;
const independentReruns=[1,2].filter(n=>fs.existsSync(fullDirectory+'/f05-volume-rerun-'+n+'.json'));
const rerun=JSON.parse(fs.readFileSync('docs/audit/'+full+'/f05-volume-rerun-1.json'));
assert.equal(rerun.status,'PASS');
const measurement=JSON.parse(fs.readFileSync(fullDirectory+'/f05-volume-rerun-measurements-1.json'));
fs.writeFileSync('docs/audit/CI-47cb743-remediation-2026-10-07.md',`# 47cb743 CI 整改与当前工程复评

> 日期：2026-10-07；修复及工程冻结源码 \`${source}\`；阶段 DEVELOPMENT。最终文档/证据提交按功能内容绑定核验，不声明同 SHA hosted CI 或 RELEASE 通过。

## 一、任务完成概况

已修复主 QuantOS CI 在 F02 隔离重建时的 \`storage.buckets.file_size_limit\` 缺列根因：F02/F05 的 runner 数据库 Gate 共用完整桶定义，新增强制迁移兼容回归。原 \`verify-download\` 下游拒绝是主构建/签名被跳过后的正确 fail-closed 行为，保持原门禁。

原 hosted CI 为9个工作流8 PASS/1 FAIL，见[原验收报告](CI-47cb743-acceptance-2026-10-07.md)。修复后的本轮工程回执、A2准入均严格有效；当前全计划 **${state}**。${human} **新候选 hosted CI 尚未执行**。

## 二、完成情况明细统计

| 检查范围 | 实际结果 | 证据与统计边界 |
|---|---|---|
| 共享 fixture / 全部桶迁移列 | 通过 | F02/F05复用同一DDL；新增静态检查纳入 \`make f02-check\` |
| 聚焦F02负向/恢复 | 初轮23 PASS、1数据库用例默认跳过 | [初轮日志](evidence/ci-47cb743-remediation-20261007/f02-focused-negative-initial.log)；跳过用例不算数据库PASS |
| Supabase临时事务实际回归 | 5 PASS、0 FAIL、0 SKIP；结束ROLLBACK | [实际日志](evidence/ci-47cb743-remediation-20261007/storage-target-pass.log)：旧DDL拒绝SQL42703、全部桶INSERT编译、重复upsert/私有性/16MiB；既有CA且TLS验证开启 |
| F0/A1完整工程 | 87个唯一命令组有效结果87 PASS | [初轮87组](${full}/execution-results.json)为86 PASS/1 FAIL；协议I/O失败组在同冻结源码完整补测PASS，共87+${independentReruns.length}个独立命令组执行，非一次87/87无失败；21基础/准备回执经标准严格校验器发布 |
| 一万事件链完整补测 | PASS | [完整同源补测](${full}/f05-volume-rerun-1.json)、[实际测量](${full}/f05-volume-rerun-measurements-1.json)；原失败不改写、不擅自扩充自动重试策略 |
| 身份/Audit | 各三组语义、8/5业务变异拒绝通过 | [原执行清单](evidence/ci-47cb743-remediation-20261007/refresh-execution-results.json)、[后续执行](evidence/ci-47cb743-remediation-20261007/refresh-completion-execution-results.json)；127项不同门禁负向PASS（身份22+44、Audit30、A2聚合31），149次实际用例执行包含22项TAP重跑，与子组统计重叠 |
| A2聚合 | 3实际命令组PASS，26API覆盖/3依赖严格READY | [当前聚合](${window}) |
| G0/FEP-0 | 16/16及2/2工程PASS | ${human} 用户确认与工程执行分别记录，确认后FEP-0又实际重评两项PASS |
| 当前内容及依赖闭包 | 26个受影响节点全部严格核验 | [闭包核验](${evidence})；当前${state}、133 NOT_ASSESSED、formalAccepted=false |
| A2旧目标复用 | 身份51调用/14强断言；Audit83调用/45断言 | 7+13目标源码逐项匹配原不可变提交/当前文件，清理回执有效；本轮未重跑业务目标调用 |

所有需要数据库的本机检查连接既有配置Supabase，未安装或运行本地PostgreSQL/Supabase/Docker。GitHub runner的F02/F05隔离数据库完整重建仍须新候选hosted执行；Supabase临时事务回归与目标漂移/RLS通过不代替该远端重建验收。

一万事件补测实际记录${measurement.eventCount}事件、${measurement.dispatched}分发、${measurement.appliedReceipts}应用回执及${measurement.uniqueSideEffects}唯一副作用，checkpoint=${measurement.checkpointNextSequence}；消费耗时${measurement.consumptionMillis}ms，目标身份链检索${measurement.correlationLookupMillis}ms、scope=\`${measurement.lookupScope}\`。该跨区域ID检索不是完整载荷≤5秒性能验收。

## 三、问题清单及风险分析

| 模块 / 问题 | 修复与状态 | 影响及剩余边界 |
|---|---|---|
| F02/F05 CI Storage fixture缺列 | 源码已修复，两个Gate共享DDL；旧结构失败/新结构通过的实际数据库回归有效 | 原问题阻断完整迁移及后续构建/签名；新候选远端CI待执行 |
| verify-download主线下载拒绝 | 无需降低门禁 | 原主签名未运行，下游拒绝正确；新候选须完整签名/下载验签通过 |
| 本轮F05 volume PostgreSQL协议I/O | 原失败保留，冻结源码完整一万事件链补测PASS | 传输中断不记作业务断言PASS；有效回执绑定真实完整补测和原失败记录 |
| 首次聚焦TLS证书链拒绝 | 原失败保留，使用工程既有CA且验证开启后PASS | 首次连接未开始测试事务，不计数据库PASS |
| 身份回执输出格式拒绝 | 原22项测试PASS，默认reporter缺少TAP标记；以显式TAP完整重跑22项后严格发布 | 原回执发布失败与原日志保留，校验器不改、已通过同源语义/阶段/变异复用 |
| G0范围人工确认 | ${human} | 根据功能范围摘要处理，旧b2确认不自动迁移 |

本轮定位TLS配置时一次搜索误覆盖私有环境文件，工具输出暴露三组测试角色数据库凭据；没有将凭据写入报告、日志证据或Git。已告知项目用户，建议轮换这三组测试凭据；本次未自行执行永久账户变更。

## 四、整改建议与后续

推送最终候选后验收其完整SHA的全部必需hosted工作流及主QuantOS CI：隔离重建/漂移/RLS、F05数据库Gate、构建打包、主线签名和下载验签。当前本机工程PASS不替代同SHA远端/正式ACCEPTED、staging、性能/长稳或RELEASE。

${human} 范围变化按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)第5步重新确认，文稿为[当前G0文稿](../gate-records/G0-user-confirmation-draft-2026-10-07-52fee5f6e499.md)。保留原 hosted 失败、完整初轮失败、TLS失败、旧计划/报告/确认快照和旧目标原件。

聚焦源码字节核验见[聚焦记录](evidence/ci-47cb743-remediation-20261007/focused-verification.json)，最终目录摘要见[证据索引](evidence/ci-47cb743-remediation-20261007/evidence-index.json)。
`);
const matrix=fs.readFileSync('docs/audit/PROVIDER-A2-comprehensive-review-2026-10-07.md','utf8').split('## 二、完成情况明细统计\n')[1].split('[机器控制矩阵]')[0];
fs.writeFileSync('docs/audit/PROVIDER-A2-comprehensive-review-2026-10-07.md',`# PROVIDER:A2：当前整改复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT；当前工程执行源码 \`${source}\`。源码、工程回执、目标复用、用户确认和 hosted CI 分别记录。

## 一、任务完成概况

原 4 项问题（1 阻塞、1 高危、1 中危、1 低危）全部 CLOSED，当前 A2 活动问题 0；原 24 个等权控制点全部 PASS，完成率 **24/24，100%**。26 个 C01/C17/C10 API 均有契约允许的成功目标证据，两子任务及聚合门禁严格 DEVELOPMENT READY、formalAccepted=false。

CI \`47cb743\` 的共享 Storage fixture 缺列已修复，全部受影响工程回执重新评估。当前全计划 ${state}。${human} 新候选 hosted CI 尚未执行，原 8 PASS/1 FAIL 不改写。

原问题与关闭依据见[初审原件](PROVIDER-A2-initial-review-2026-10-07.md)、[关闭记录](evidence/provider-a2-remediation-20261007/closed-findings.json)。CI 修复前报告原件保存在[整改快照](evidence/ci-47cb743-remediation-20261007/before/PROVIDER-A2-comprehensive-review-2026-10-07.md)。

## 二、完成情况明细统计
${matrix}
| 验证层 | 当前有效结果 | 证据与边界 |
|---|---|---|
| F0/A1 | 87 个唯一命令组有效结果全部 PASS；初轮 86 PASS/1 FAIL，一万事件链协议 I/O 失败在同冻结源码完整补测 PASS；21 基础节点经标准校验器发布 | [原87组](${full}/execution-results.json)、[有效87组](${full}/effective-execution-results.json)、[完整补测](${full}/f05-volume-rerun-1.json)；原失败保留，未标为成功 |
| 身份/Audit | 两任务各三组语义及 8/5 个业务变异拒绝通过；身份契约22项、阶段44项，Audit契约/阶段30项 PASS | [身份回执](${identity})、[Audit回执](${audit}) |
| A2 聚合 | 26 API、3直接依赖、规范输入、三个实际命令组及31项专用负向通过 | [聚合回执](${window}) |
| 全部门禁负向 | 本轮127项不同用例PASS（22+44+30+31）；149次执行含22项TAP重跑，与子任务统计重叠 | [原执行清单](evidence/ci-47cb743-remediation-20261007/refresh-execution-results.json)、[后续执行](evidence/ci-47cb743-remediation-20261007/refresh-completion-execution-results.json) |
| 原目标复用 | 身份51调用/14强断言、Audit83调用/45断言，cleanupVerified=true；7+13项目标源码与原不可变提交及当前文件一致 | [当前严格核验](${evidence})；本轮未重跑两任务目标调用 |
| G0/FEP-0 | ${human} | [当前严格核验](${evidence}) |

所有需数据库的本机检查连接已配置 Supabase，未建立本地数据库。身份/Audit 原目标提交分别为 \`d758c839fbd57366346d0f2b9ef2081c68ab51e6\` / \`5e3339c9e5cc95d550c6e67ffa36701998cb0e2f\`，目标调用时间、范围和清理原件保持原事实。

## 三、问题清单及风险分析

| 优先级 | 当前 A2 活动问题 | 原问题已关闭 |
|---|---:|---:|
| 阻塞级 | 0 | 1 |
| 高危 | 0 | 1 |
| 中危 | 0 | 1 |
| 低危 | 0 | 1 |

原成功状态、执行提交溯源、聚合门禁和文档一致性问题的关闭记录继续有效。跨模块 CI fixture 整改另见[CI 整改报告](CI-47cb743-remediation-2026-10-07.md)，不将本轮本机 Supabase 检查称为 GitHub runner 隔离重建通过。

${human} 历史 \`b2fd984536e0\` 用户答复和回执保留，未迁移至新范围。A2 READY 仅关闭后续任务的一项依赖；PROVIDER:ALL、consumer/UI联调、staging、真实部署/IdP、性能/长稳、hosted CI 和 RELEASE 正式验收继续独立。

## 四、整改建议与后续维护

A2 原整改没有遗留代码项。保持 \`pnpm check:provider-a2\`、\`pnpm test:provider-a2\` 为强制 CI 门禁。功能输入或依赖变化后重新评估；目标功能字节未变且不可变提交及清理记录有效时可复用目标原件，功能变化时执行相应 Supabase 回归。

推送本轮新候选后核验完整 hosted CI、主构建签名和下载验签。G0 范围确认按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)处理，不自行批准。
`);
for(const [file,oldReceipt,newReceipt]of [
 ['BFF-FE-001-comprehensive-review-2026-10-05.md','evidence/bff-fe-001-remediation-20261005/provider-a2-final-reassessment-20261007/a2.json',identity],
 ['BFF-FE-007-comprehensive-review-2026-10-06.md','evidence/bff-fe-007-remediation-20261006/provider-a2-final-reassessment-20261007/development.json',audit]]){
 const path='docs/audit/'+file;let text=fs.readFileSync(path,'utf8');
 text=text.replaceAll('fac94ef3f9a7c5cb67f15f2c1d1ed84f40bdf094',source).replaceAll(oldReceipt,newReceipt).replaceAll('evidence/provider-a2-remediation-20261007/closure-verification.json',evidence);
 text=text.replace('当前全计划 26 READY、0 BLOCKED。当前 G0 用户确认已核验，G0/FEP-0 严格 READY。',`当前全计划 ${state}。${human}`);
 text=text.replace('## 三、',`本轮 CI fixture 修复后，重新执行本任务语义/负向/变异并严格核验当前依赖；详见[CI 整改报告](CI-47cb743-remediation-2026-10-07.md)。旧当前报告快照保留，新候选 hosted CI 尚未执行。\n\n## 三、`);
 fs.writeFileSync(path,text);
}
const intro=`> 2026-10-07 CI \`47cb743\` 的 F02/F05 Storage fixture 缺列已修复；冻结源码 \`d00041e\` 的87个命令组有效结果、A2子门禁及聚合、G0/FEP-0工程均通过。当前 ${state}；${human} 新候选 hosted CI 待推送验证，原失败保留。见[整改报告](./audit/CI-47cb743-remediation-2026-10-07.md)。`;
const planPaths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
const texts=planPaths.map((path,index)=>{
 let text=fs.readFileSync(path,'utf8');text=text.replace(/^> 2026-10-07 CI[^\n]+/,intro);
 text=text.replace(`> 版本：${index===0?'3.36':'3.40'}`,`> 版本：${index===0?'3.37':'3.41'}`);
 if(index===0)text=text.replace(/^> 本轮变更：.*$/m,`> 本轮变更：F02/F05共享Storage fixture及迁移兼容回归修复；当前 ${state}。${human} 原hosted失败和新候选分开验收。`);
 else text=text.replace(/^> 状态：.*$/m,`> 状态：CI fixture修复及当前工程复评完成；${state}；新候选hosted CI待推送验证`);
 const heading=index===0?'## 版本变更说明':'## 版本变更说明';
 if(text.includes(heading))text=text.replace(heading,heading+`\n\n- \`${index===0?'3.37':'3.41'}\`：修复共享Storage fixture缺列；87组有效结果PASS，原86PASS/1协议I/O失败与同源完整补测分开保留，21基础回执重新发布。两BFF语义/变异及127门禁负向通过，A2严格READY；当前 ${state}。${human} 新hosted CI未执行，历史正式字段不迁移。`);
 text=text.replaceAll('core-plan-format-reassessment-20261007/','ci-47cb743-reassessment-20261007/');
 text=text.replaceAll('bff-fe-001-remediation-20261005/provider-a2-final-reassessment-20261007/','bff-fe-001-remediation-20261005/ci-47cb743-final-reassessment-20261007/');
 text=text.replaceAll('provider-a2-final-reassessment-20261007/','ci-47cb743-reassessment-20261007/');
 text=text.replaceAll('./audit/evidence/provider-a2-remediation-20261007/development/provider-a2.json','./audit/'+window);
 text=text.replaceAll('./audit/evidence/provider-a2-remediation-20261007/closure-verification.json','./audit/'+evidence);
 text=text.replaceAll('本轮 87/87 实际执行见[旧 READY 复评报告](./audit/Core-plan-READY-reassessment-2026-10-07.md)','本轮87组有效工程执行及完整补测见[CI整改报告](./audit/CI-47cb743-remediation-2026-10-07.md)');
 if(index===1){text=text.replace(/^- 当前工程复核：2026-10-07，用户确认当前 G0 文稿后[^\n]+$/m,`- 当前工程复核：2026-10-07，当前范围的两项工程检查PASS，八依赖及当前状态严格核验；${human} 见[CI整改报告](./audit/CI-47cb743-remediation-2026-10-07.md)和[当前功能回执](./${currentFep0})。`);text=text.replace('当前阶段归属以 3.38、第 2.1 节','当前阶段归属以 3.41、第 2.1 节');}
 return text;
});
const after=nodesFromPlans(texts);for(const [id,n]of before)assert.deepEqual(planInput(after.get(id)),planInput(n),'normative plan changed '+id);
for(let i=0;i<2;i++)fs.writeFileSync(planPaths[i],texts[i]);
console.log(JSON.stringify({status:'PASS',state,normativePlansUnchanged:true}));
