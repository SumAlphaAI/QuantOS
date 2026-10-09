import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {expectedQueue,validateQueue,checkQueue} from './tp01-d-patch-queue.mjs';
test('exact two-family queue binds current locked sources and QuantOS replacements',()=>{const q=expectedQueue();assert.equal(validateQueue(q).status,'PASS');assert.equal(q.upstream.repository,JSON.parse(readFileSync(new URL('../third_party/vibe-trading/baseline.lock.json',import.meta.url))).upstream.repositoryUrl);});
test('actual queue documents and inventory agree',()=>assert.equal(checkQueue().entries,2));
for(const [name,change]of [
 ['old baseline',q=>q.upstream.commit=q.originCommit],
 ['invented upstream',q=>q.upstream.repository='https://example.invalid/agent.git'],
 ['omitted design',q=>q.queue.pop()],
 ['duplicate design',q=>q.queue.push(q.queue[0])],
 ['new session family',q=>q.queue[0].designFamily='session_store'],
 ['direct import',q=>q.queue[0].mode='direct-runtime-reuse'],
 ['extra patch',q=>q.queue.push({...q.queue[0],id:'0003'})],
 ['unreviewed target',q=>q.queue[0].adapterModule='services/execution-gateway/src/main.rs'],
 ['path escape',q=>q.queue[0].referenceSources[0].path='../../.env.local'],
 ['source digest',q=>q.queue[0].referenceSources[0].sha256='sha256:'+'0'.repeat(64)],
 ['unknown source',q=>q.queue[0].referenceSources.push({path:'agent/src/memory/persistent.py',sha256:'sha256:'+'0'.repeat(64)})],
 ['missing permission replacement',q=>delete q.queue[0].boundaryReplacements.auth],
 ['upstream storage',q=>q.queue[0].boundaryReplacements.storage='upstream-memory'],
 ['false status',q=>q.queue[0].status='unreviewed'],
 ['missing document',q=>delete q.queue[0].document],
 ['extra capability',q=>q.queue[0].venueCapability=true],
])test('patch queue rejects '+name,()=>{const q=structuredClone(expectedQueue());change(q);assert.throws(()=>validateQueue(q));});
