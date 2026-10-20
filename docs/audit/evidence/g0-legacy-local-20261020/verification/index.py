from pathlib import Path
import json,hashlib,subprocess
D=Path('docs/audit/evidence/g0-legacy-local-20261020');sha=lambda b:'sha256:'+hashlib.sha256(b).hexdigest()
save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
summary=json.loads((D/'review-summary.json').read_text());source=summary['sourceCommit']
changed=set(subprocess.check_output(['git','diff','--name-only','-z','6ade11bf']).decode().split('\0'));changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z']).decode().split('\0'));changed.discard('');changed.update(str(D/p) for p in ['changed-files.md','index.json','independent-verification.json'])
(D/'changed-files.md').write_text('# 本任务变更文件\n\n任务起点6ade11bf、main干净。原G0确认收口f7141e4b；迁移源码1833d223；编译AST检查修复/最终冻结源4fdc67b41b1cf30215ca96a0ac2fe97d6729dc83。最终证据提交由Git记录；未推送。\n\n主要实现：生产API四模块仅兼容类型；状态/旧port移到测试fixture并经生成operation/schema adapter；29原场景保留；新增移除/adapter/G0-ALL门禁测试；双计划、台账、CI、确认收口和原始证据同步。完整清单：\n\n'+'\n'.join('- `'+p+'`' for p in sorted(changed))+'\n')
files=[p for p in sorted(D.rglob('*')) if p.is_file() and p.name not in ['index.json','independent-verification.json']];files.extend(Path(p) for p in ['docs/audit/G0-legacy-backend-review-2026-10-20.md','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'])
index={'schema':'quantos-g0-legacy-evidence-index/v1','sourceCommit':source,'excludedSelfCycle':['index.json','independent-verification.json'],'files':[{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in files]};save(D/'index.json',index)
for i in json.loads((D/'index.json').read_text())['files']:assert sha(Path(i['path']).read_bytes())==i['sha256'],i['path']
gates=json.loads((D/'verification/post-document-gates.json').read_text());assert gates['g0']['engineeringStatus']==gates['all']['engineeringStatus']=='PASS';assert gates['g0']['status']==gates['all']['status']=='BLOCKED';assert gates['all']['legacyRemoval']=='COMPLETE';assert gates['all']['blockers']==['G0_CURRENT_SCOPE_CONFIRMATION_PENDING']
entries=json.loads((D/'function-attempt-02/entrypoints/results.json').read_text());assert [i['exitCode'] for i in entries]==[0,1,0,2,0,0,0,0]
assert json.loads((D/'verification/plans.log').read_text())['stage_status_counts']=={'NOT_ASSESSED':157,'READY':0,'BLOCKED':2}
assert json.loads((D/'function-attempt-01/failure.json').read_text())['status']=='FAIL'
save(D/'independent-verification.json',{'schema':'quantos-g0-legacy-independent-verification/v1','status':'PASS','sourceCommit':source,'indexSha256':sha((D/'index.json').read_bytes()),'indexedFiles':len(files),'hashVerification':'ALL_MATCH','postDocumentGates':gates,'actualEntrypointExits':[i['exitCode'] for i in entries],'failedAttempt':'RETAINED_NOT_PASS','originalG0Closure':'READY_AT_ORIGINAL_e4434952_SCOPE','currentSourceConfirmation':'PENDING_NOT_SELF_APPROVED','legacyRemoval':'COMPLETE_ENGINEERING_ONLY','phases':summary['phases'],'production':False,'databaseExecution':False,'formalAccepted':False,'runtimeAdmission':'DENIED','externalPublished':False})
print('INDEX PASS',len(files),'files')
