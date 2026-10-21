from pathlib import Path
import json,re,subprocess,hashlib,io,collections,gzip
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
s=args.output;s.mkdir(parents=True,exist_ok=True)
findings=json.loads(gzip.decompress(Path(__file__).with_name('history-findings.json.gz').read_bytes()));cache={};checks=[];blob_queries={};commit_queries={}
for r in findings:
 assert r['RuleID']=='generic-api-key' and r['File'].startswith('docs/audit/evidence/')
 k=(r['Commit'],r['File'])
 if k not in cache:cache[k]=subprocess.check_output(['git','show',k[0]+':'+k[1]],text=True).splitlines()
 line=cache[k][r['StartLine']-1]
 m=re.fullmatch(r'\s*"([^"]+)"\s*:\s*"([0-9a-f]{64})",?\s*',line)
 if m:
  source,value=m.groups();assert source.startswith('docs/audit/evidence/') and not ('..' in source.split('/'))
  query=r['Commit']+':'+source;blob_queries[query]=value;kind='FILE_SHA256'
 elif (m:=re.fullmatch(r'\s*"(originalApiSourceCommit|originalApiSource)"\s*:\s*"([0-9a-f]{40})",?\s*',line)):
  source,value=m.groups();query=value;commit_queries[query]=True;kind='GIT_COMMIT_ID'
 else:
  m=re.fullmatch(r'\s*"scopeSummary"\s*:\s*"((?:BFF010_SCOPE_LOCAL original43 C11/C16 [A]PIs, frozen3152db47 and original1146|A4_SCOPE_LOCAL original32 [A]PI aggregation, frozen1297bc3b and original1053) inputs only; no current HEAD, upstream, full integration, target, runtime or release approval)",?\s*',line)
  assert m, (r['File'],r['StartLine'],'unrecognized historical finding')
  source='scopeSummary';value=m[1];query=None;kind='LITERAL_SCOPE_SUMMARY'
 checks.append({'fingerprint':r['Fingerprint'],'findingFile':r['File'],'findingCommit':r['Commit'],'line':r['StartLine'],'kind':kind,'source':source,'value':value,'query':query})
queries=list(blob_queries)+list(commit_queries)
result=subprocess.run(['git','cat-file','--batch-check=%(objectname) %(objecttype)'],input='\n'.join(queries)+'\n',text=True,capture_output=True,check=True)
objects={}
for query,line in zip(queries,result.stdout.splitlines(),strict=True):
 parts=line.split();assert len(parts)==2 and parts[1] in ['blob','commit'],(query,line)
 objects[query]=parts
for query in blob_queries:assert objects[query][1]=='blob'
for query in commit_queries:assert objects[query][1]=='commit'
ids=sorted(set(objects[q][0] for q in blob_queries))
payload=subprocess.run(['git','cat-file','--batch'],input=('\n'.join(ids)+'\n').encode(),capture_output=True,check=True).stdout
stream=io.BytesIO(payload);digests={}
for expected in ids:
 header=stream.readline().decode().strip().split();assert header[0]==expected and header[1]=='blob'
 data=stream.read(int(header[2]));assert stream.read(1)==b'\n';digests[expected]=hashlib.sha256(data).hexdigest()
for q,value in blob_queries.items():assert digests[objects[q][0]]==value,(q,'digest mismatch')
assert len(checks)==4876 and len(set(r['fingerprint'] for r in checks))==4876
for c in checks:
 if c['query'] is not None:c['verifiedGitObject']=objects[c['query']][0]
 c.pop('query');c.pop('value')
summary={'schema':'quantos-verified-historical-findings/v1','sourceCommit':'49c5772f18f8be3b10eae42a9243336443f53199','status':'ALL_INDEPENDENTLY_VERIFIED_NON_CREDENTIALS','findings':len(checks),'categories':dict(collections.Counter(c['kind'] for c in checks)),'findingFileRevisions':len(cache),'referencedFileRevisions':len(blob_queries),'verifiedUniqueSourceBlobs':len(ids),'verifiedGitCommits':len(commit_queries),'policy':'Only immutable commit/path/rule/line fingerprints; no path, key-name, or hex-value blanket allowance','originalEvidenceBytes':'UNCHANGED','detailedChecksSha256':hashlib.sha256(json.dumps(checks,sort_keys=True).encode()).hexdigest()}
(s/'historical-finding-verification.json').write_text(json.dumps(summary,indent=2)+'\n')
(s/'historical-finding-checks.json.gz').write_bytes(gzip.compress(json.dumps(checks,indent=2).encode(),mtime=0))
(s/'verified-fingerprints.txt').write_text('\n'.join(sorted(c['fingerprint'] for c in checks))+'\n')
print(json.dumps(summary,indent=2))
