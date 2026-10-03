from pathlib import Path
import hashlib,json,subprocess
folder=Path(__file__).resolve().parent;root=folder.parents[3]
def save(name,data):(folder/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
items=[
('B-01','阻塞级','计划 schema 与 validator 对齐；当前前端/核心/二期计划结构及负向回归通过',['plans.log','plan-negative.log']),
('H-01','高危','实际配置语义与构建绑定通过；补充逐应用环境隔离及 .env.local/注入 profile 校验',['web-negative.log','source.json','profile-check.json','before-env-file-smoke.log']),
('H-02','高危','真实资源、页面与脚本错误检查；伪 HTML/坏资源/脚本故障均被拒绝',['web-negative.log','web-smoke.log','browser-terminal.log','browser-website.log']),
('M-01','中危','ADR 现行版本与 29 项目标依赖一致，版本与重复行漂移被拒绝',['web-smoke.log','web-negative.log']),
('M-02','中危','默认 Web 无 Desktop 依赖；移除 Desktop 后通过；显式 Desktop companion workspace 仍受检',['web-isolation.log','desktop-reference.log']),
('M-03','中危','workflow 安装 Chromium 并执行 check:pre03:web 与 test:pre03；本地回归通过，远端执行未宣称',['web-negative.log']),
('M-04','中危','声明、specifier、解析图检查通过；补齐独立 manifest 发现、完整 importer、正确 link 与 overrides 校验',['before-lock-probes.json','web-negative.log','bootstrap.log','node-lock.log']),
('M-05','中危','React Testing Library/jsdom 直接声明；UI 19 项（含真实状态交互）与 workspace 177 项通过',['unit.log']),
('M-06','中危','标准静态 start 与真实 404 通过；推荐 .env.local 配置构建与回执链路补验通过',['build.log','start-browser.json','source.json']),
('L-01','低危','Next 插件加载，专用规则负向用例拒绝；构建无插件缺失警告',['lint.log','build.log','web-negative.log'])]
save('closure.json',{'baseline':'eaa294120ab2b62dfaa211c7dd3f9901fdb46738','scope':'repository phase-one Web acceptance','closed':10,'open':0,'issues':[{'id':i,'original_severity':s,'status':'CLOSED','verification':v,'evidence':e} for i,s,v,e in items]})
paths=set(subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
inputs={}
for p in sorted(paths):
 if p.startswith(('scripts/','apps/terminal/','apps/website/','packages/')) or p in ['package.json','pnpm-lock.yaml','pnpm-lock.desktop.yaml','pnpm-lock.phase1.yaml','pnpm-workspace.yaml','pnpm-workspace.desktop.yaml','.nvmrc','eslint.config.mjs','tsconfig.base.json','.github/workflows/frontend-baseline.yml','docs/adr/20260814-pre03-runtime-stack.md','docs/PRE-03-summary.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md']:
  if (root/p).is_file():inputs[p]=hashlib.sha256((root/p).read_bytes()).hexdigest()
artifacts={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file() and p.name!='manifest.json'}
save('manifest.json',{'schema':'quantos-pre03-recheck/v1','date':'2026-10-02','baseline':'eaa294120ab2b62dfaa211c7dd3f9901fdb46738','source_binding':json.loads((folder/'source.json').read_text()),'environment':{'os':'macOS','node':'24.12.0','pnpm':'10.20.0','profile':'checked-in local-mock .env.local per app; no injected NEXT_PUBLIC in clean replay','install':'frozen offline; empty workspace node_modules; existing host download store'},'result':'PASS','control_points':{'pass':15,'partial':0,'fail':0,'completion_percent':100},'original_issues':{'blocker':1,'high':2,'medium':6,'low':1,'closed':10},'open_issues':{'blocker':0,'high':0,'medium':0,'low':0},'tests':{'unit':177,'unit_files':25,'ui_subset':19,'pre03_web':27,'desktop_reference':4,'plan':22,'pre02':27,'browser_targets':3},'clean_replay':{'commands':16,'all_exit_zero':True,'main_chain_seconds':32.278,'all_commands_seconds':60.932},'extra_checks':{'standard_start':'PASS','real_404':'PASS','desktop_removed':'PASS','same_profile_injected':'PASS','changed_env_file_rejected':'PASS','changed_injection_rejected':'PASS','current_repository_source_digest_matches_builds':True},'notes':['Build IDs identify archive baseline; sourceDigest and input SHA256 identify baseline plus repairs.','before-* records reproduce initial omissions; fixture-attempt is a superseded verification attempt whose temporary fixture accidentally triggered Next TypeScript auto-install. Fixture root resolution and config inspection preflight were corrected; final root logs are authoritative.','CI workflow wiring is source-inspected; remote CI was not executed.','Historical evidence directories remain unchanged.'], 'not_run':['remote GitHub CI','formal G0','designated-model review','provider/staging','Firefox/WebKit','cold network install','database','native build/install','full F01 cross-language acceptance'],'input_sha256':inputs,'artifact_sha256':artifacts})
print('closed=10; controls=15/15; inputs='+str(len(inputs))+'; artifacts='+str(len(artifacts)))
