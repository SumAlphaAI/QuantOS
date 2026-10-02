import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {parseEnvText}=await import(pathToFileURL(join(root,'packages/config/src/env-file.ts')));
const {validateEnv}=await import(pathToFileURL(join(root,'packages/config/src/env.ts')));
const appRequire=createRequire(join(root,'apps/terminal/package.json'));const require=createRequire(appRequire.resolve('next/package.json'));const {loadEnvConfig}=require('@next/env');
const dir=mkdtempSync(join(tmpdir(),'pre05-dotenv-'));
try {
 const text=readFileSync(join(root,'env/local-mock.env.example'),'utf8').replace('NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=true','NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=true # local mock');
 writeFileSync(join(dir,'.env.local'),text);const actual=loadEnvConfig(dir,false,console,true).parsedEnv;const parsed=parseEnvText(text);
 const result={cli_ok:validateEnv(parsed).ok,next_ok:validateEnv(actual).ok,values_identical:JSON.stringify(parsed)===JSON.stringify(actual),cli_mock_value:parsed.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED,next_mock_value:actual.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED};
 writeFileSync(new URL('parser-comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.cli_ok||!result.next_ok||!result.values_identical)process.exitCode=1;
}finally{rmSync(dir,{recursive:true,force:true});}
