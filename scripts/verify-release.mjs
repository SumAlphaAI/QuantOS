import fs from 'node:fs';
import path from 'node:path';
import {sha,files} from './f01-lib.mjs';
import {fileURLToPath} from 'node:url';
export function verifyRelease(directory,expectedCommit){
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
 if(manifest.kind!=='release' || !/^[a-f0-9]{40}$/.test(expectedCommit??'') || manifest.git.commit!==expectedCommit || manifest.git.dirty!==false)throw Error('RELEASE_SOURCE: expected clean commit does not match');
 const actual=files(directory).map(p=>path.relative(directory,p)).filter(p=>p!=='manifest.json').sort();
 const expected=manifest.files.map(p=>p.path).sort();
 for(const file of actual)if(file.startsWith('web/')) {
  const buffer=fs.readFileSync(path.join(directory,file));
  const magic=buffer.subarray(0,4).toString('hex');
  if(/\.(node|so|dylib|dll|wasm)$/i.test(file)||['7f454c46','0061736d','cffaedfe','feedfacf','cafebabe'].includes(magic)||file.includes('node_modules/'))throw Error('RELEASE_LICENSE: native/build-only dependency in Web payload');
 }
 if(new Set(expected).size!==expected.length||JSON.stringify(actual)!==JSON.stringify(expected))throw Error('RELEASE_INVENTORY: missing or extra files');
 for(const item of manifest.files){
  if(path.isAbsolute(item.path)||item.path.split(/[\\/]/).includes('..'))throw Error('Invalid release path');
  const bytes=fs.readFileSync(path.join(directory,item.path));
  if(bytes.length!==item.sizeBytes||sha(bytes)!==item.sha256)throw Error(`RELEASE_DIGEST: ${item.path}`);
 }
 const sbom=JSON.parse(fs.readFileSync(path.join(directory,'sbom/quantos.spdx.json')));
 if(sbom.packages.find(p=>p.SPDXID==='SPDXRef-Package-QuantOS')?.versionInfo!==expectedCommit)throw Error('RELEASE_SBOM: source mismatch');
 console.log(`Verified ${manifest.files.length} release files for ${expectedCommit}`);
 return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url))verifyRelease(path.resolve(process.argv[2]??'artifacts/release'),process.argv[3]??process.env.GITHUB_SHA);
