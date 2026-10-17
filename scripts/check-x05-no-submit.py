"""X05 source boundary check; complements compile-fail and native protocol tests."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parent.parent
paths=['crates/quantos-reconcile/src/'+n for n in ['lib.rs','model.rs','shadow.rs','reconciliation.rs','exceptions.rs','bin/quantos-reconcile.rs']]
rows=[]
for path in paths:
 raw=(root/path).read_bytes();text=raw.decode();code=re.sub(r'/\*.*?\*/','',text,flags=re.S);code=re.sub(r'//[^\n]*','',code)
 for pattern in [r'\.\s*(?:submit|submit_at|cancel|issue|secret|connect)\s*\(',r'\b(?:reqwest|TcpStream|UdpSocket|ExecutionKernel|SignedExecutionGateway|CommandIssuer|Vault|unsafe|include_bytes|libloading)\b',r'std::process',r'std::fs',r'std::env::(?:var|vars|var_os|vars_os)']:
  assert not re.search(pattern,code),(path,pattern)
 if path.endswith('shadow.rs'):
  assert 'ExecutionGateway' not in code and 'NautilusBoundaryAdapter' not in code
  assert 'RiskGuard' in code and 'with_current_allow' in code
 rows.append({'path':path,'sha256':'sha256:'+hashlib.sha256(raw).hexdigest()})
# The sole gateway method used by the read adapter remains a non-dispatch replay.
raw=(root/'crates/quantos-execution/src/gateway.rs').read_text();start=raw.index('    pub fn replay_facts(');end=raw.index('    pub fn submission_state(',start);replay=raw[start:end]
assert not re.search(r'\.\s*(?:submit|submit_at|cancel)\s*\(',replay)
assert 'ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts' in (root/paths[3]).read_text()
print(json.dumps({'schema':'quantos-x05-no-submit/v1','status':'PASS','venueSubmitPath':'ABSENT','scope':'New production modules and owned read-only replay call; not a target OS sandbox attestation','files':rows,'readAdapterMethod':'ExecutionGateway::replay_facts','readAdapterSourceSha256':'sha256:'+hashlib.sha256(raw.encode()).hexdigest()}))
print('X05_NO_VENUE_SUBMIT_PATH=ABSENT')
