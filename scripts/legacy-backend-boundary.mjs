import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
export const domains=['terminal','strategy','execution','ops'];
export const modelFiles=domains.map(n=>'packages/api-client/src/'+n+'.ts');
export const removedExports=domains.map(n=>'InMemory'+n[0].toUpperCase()+n.slice(1)+'Backend').concat(['TerminalClient','createTerminalClient']);
export function validateModelOnly(source,path='models.ts'){
 const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 assert.equal(tree.parseDiagnostics.length,0,'invalid compatibility type source');
 assert(tree.statements.length>0,'missing compatibility models');
 for(const s of tree.statements)assert(ts.isInterfaceDeclaration(s)||ts.isTypeAliasDeclaration(s),'legacy runtime statement remains '+path);
 assert(!/(?:InMemory\w+Backend|export interface (?:Terminal|Strategy|Execution|Ops)Backend)/.test(source),'legacy backend remains '+path);
 return tree.statements.length;
}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
export function validateRemoval({read=p=>readFileSync(p,'utf8'),list=files,artifacts=false}={}){
 let declarations=0;for(const p of modelFiles)declarations+=validateModelOnly(read(p),p);
 const roots=['packages/api-client/src','apps/terminal/src','apps/terminal/app','packages/domain-ui/src','packages/ui/src','packages/platform/src','packages/config/src'];
 const paths=roots.flatMap(list).filter(p=>/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(p)&&!p.includes('.stories.'));
 for(const p of paths){const source=read(p);assert(!/InMemory(?:Terminal|Strategy|Execution|Ops)Backend/.test(source),'production legacy reference '+p);const tree=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true);const visit=node=>{if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))assert(!/(?:^|\/)(?:tests|__tests__|fixtures)(?:\/|$)/.test(node.moduleSpecifier.text),'production fixture import '+p);ts.forEachChild(node,visit)};visit(tree);}
 const adapters=domains.map(n=>'apps/terminal/tests/fixtures/scenarios/'+n+'.ts');
 for(const p of adapters){const source=read(p);assert(source.includes('generatedScenario('),'missing generated adapter '+p);assert(!source.includes('export class Scenario'),'fixture state must be private');}
 if(artifacts)for(const n of domains){const p='packages/api-client/dist/src/'+n+'.js';assert(existsSync(p),'current compiled client missing '+p);assert.match(read(p).trim(),/^export\s*\{\s*\};(?:\s*\/\/.*)?$/,'compiled compatibility models contain runtime');}
 return{schema:'quantos-legacy-backend-removal/v1',status:'PASS',legacyRuntimeClasses:0,productionFiles:paths.length,compatibilityTypeDeclarations:declarations,modelFiles,adapters,generatedContract:'OPERATION_METADATA_AND_GENERATED_RESPONSE_SCHEMAS',compiledClient:artifacts?'PASS':'NOT_RUN',formalClosed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(validateRemoval({artifacts:process.argv.includes('--artifacts')}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
