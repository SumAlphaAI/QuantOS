"""Read pinned public UI files into memory; retain digests and owned observations only."""
from pathlib import Path
import concurrent.futures
import datetime
import hashlib
import json
import sys
import urllib.request

root=Path(__file__).resolve().parents[4]
base=Path(__file__).resolve().parent
pin='9793e9c0563fbf56fc096757d8bb80e209ac7aab'
rows=[
 ('components/valuecell/app/app-sidebar.tsx','Persistent navigation separates entry, agent destinations and footer actions; agent entries have tooltips.',['VC-01'],'Use authorized QuantOS domain routes; no agent-driven authority.'),
 ('components/valuecell/app/app-conversation-sheet.tsx','A side sheet lists prior conversations with timestamps and per-item actions.',['VC-04'],'Use immutable research history; do not import upstream conversation schema or deletion semantics.'),
 ('app/home/components/stock-search-modal.tsx','A search dialog filters stock entries, separates empty/loading states and displays per-item watchlist action feedback.',['VC-05','VC-10'],'Use licensed snapshot-backed discovery and explicit stale/permission states; no upstream market adapter.'),
 ('app/home/components/stock-list.tsx','A scrollable watchlist organizes selected instruments into repeatable list items.',['VC-05'],'Use QuantOS DataGrid and controlled selection; filters persist in URL.'),
 ('app/home/components/agent-task-cards.tsx','Two-column task cards associate agent identity and time with result links.',['VC-02','VC-03','VC-07'],'Use ResearchArtifact/evidence cards; this is not evidence of a committee or counter-view implementation.'),
 ('app/agent/components/chat-conversation/chat-conversation-header.tsx','A context header combines identity tags with new-conversation and configuration navigation.',['VC-01','VC-09'],'Expose only authorized research actions and version metadata; no upstream settings/accounts.'),
 ('app/agent/components/chat-conversation/chat-input-area.tsx','A multiline input composes text and sends through keyboard/button handlers.',['VC-02'],'Use bounded ResearchComposer with snapshot, budget and deadline checks; text never authorizes trading.'),
 ('app/agent/components/chat-conversation/chat-item-area.tsx','Conversation items dispatch to typed renderers and retain an unsupported-content fallback.',['VC-09'],'Use allowlisted, redacted QuantOS artifact previews; arbitrary renderer content cannot execute tools.'),
 ('app/agent/components/chat-conversation/chat-multi-section-component.tsx','A separate report section presents a title, return action and rendered report body.',['VC-03','VC-09'],'Preserve resource authorization and return context; report text is not verified evidence by itself.'),
 ('app/agent/components/chat-conversation/chat-streaming-indicator.tsx','A streaming indicator exposes an output region with visible activity feedback.',['VC-08'],'Use authoritative run state and server-confirmed cancellation; activity is not success.'),
 ('app/agent/components/chat-conversation/chat-welcome-screen.tsx','The initial empty conversation screen makes the input action immediately available.',['VC-10'],'Offer only permitted research next steps with reason; no trading prompt or permission bypass.'),
 ('components/valuecell/renderer/chat-conversation-renderer.tsx','A nested conversation card combines context, running feedback and a detail link.',['VC-02','VC-08','VC-09'],'Keep intermediate/final distinction and native evidence links; no notification or approval authority.'),
]

def online(row):
 path,observation,refs,constraint=row
 path='frontend/src/'+path
 url=f'https://raw.githubusercontent.com/ValueCell-ai/valuecell/{pin}/{path}'
 raw=urllib.request.urlopen(url,timeout=60).read()
 assert raw and len(raw)>100
 return {'path':path,'url':url,'sizeBytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'observation':observation,'basis':'PINNED_STATIC_SOURCE_STRUCTURE','patternRefs':refs,'quantosConstraint':constraint,'sourceBytesRetained':False,'runtimeBehaviorVerified':False}

path=base/'ia-source-review.json'
if '--record' in sys.argv:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
  observations=list(pool.map(online,rows))
 record={'schema':'quantos-tp10-static-ia-review/v1','sourceCommit':pin,'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'upstreamExecuted':False,'sourceBytesRetained':False,'runtimeBehaviorVerified':False,'formalAccepted':False,'observations':observations,'limitation':'Static source structure, not shipped/runtime/browser/usability verification. Existing source grades are conservative design-inspiration grades; this supplement does not reclassify roadmap or QuantOS extensions as delivered upstream features.'}
 path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
r=json.loads(path.read_text());assert r['schema']=='quantos-tp10-static-ia-review/v1' and r['sourceCommit']==pin
for k in ['upstreamExecuted','sourceBytesRetained','runtimeBehaviorVerified','formalAccepted']:assert r[k] is False
assert len(r['observations'])==len(rows)==12 and len({x['path']for x in r['observations']})==12
patterns=json.loads((root/'third_party/valuecell/patterns.json').read_text())['patterns']
spec=(root/'docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md').read_text()
for expected,x in zip(rows,r['observations'],strict=True):
 p,observation,refs,constraint=expected
 assert x['path']=='frontend/src/'+p and x['observation']==observation and x['patternRefs']==refs and x['quantosConstraint']==constraint
 assert x['url']==f'https://raw.githubusercontent.com/ValueCell-ai/valuecell/{pin}/{x["path"]}'
 assert x['sizeBytes']>100 and len(x['sha256'])==64 and int(x['sha256'],16)>=0
 assert x['sourceBytesRetained'] is False and x['runtimeBehaviorVerified'] is False
 for ref in refs:
  mapped=next(v for v in patterns if v['id']==ref)
  assert '<a id="'+mapped['terminalSpec'].split('#')[1]+'"></a>' in spec
if '--verify-upstream' in sys.argv:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:assert list(pool.map(online,rows))==r['observations']
proof={'schema':'quantos-tp10-static-ia-review-receipt/v1','status':'PASS','formalAccepted':False,'observations':12,'specTargetsVerified':True,'sourceBytesRetained':False,'runtimeBehaviorVerified':False,'reviewSha256':'sha256:'+hashlib.sha256(path.read_bytes()).hexdigest(),'reviewerSha256':'sha256:'+hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'onlineDigestsRevalidated':'--verify-upstream' in sys.argv,'executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(base/'ia-source-review-receipt.json').write_text(json.dumps(proof,indent=2)+'\n')
print('TP10_STATIC_IA_SOURCE_REVIEW_PASS',json.dumps(proof))
