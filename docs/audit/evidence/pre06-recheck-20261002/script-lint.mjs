import { ESLint } from 'eslint';
import globals from 'globals';
import fs from 'node:fs';
const files=['scripts/check-perf-budget.mjs','scripts/check-pre06.mjs','scripts/check-visual-baselines.mjs','scripts/pre06-gate-negative.mjs','scripts/pre06-runtime-negative.mjs','scripts/pre06-sabotage-check.mjs','scripts/pre06-test-structure.mjs','tests/contract/validate.mjs','tests/contract/fixture-inventory.mjs'];
const eslint=new ESLint({overrideConfig:[{files:['**/*.mjs'],languageOptions:{globals:globals.node}}]});
const results=await eslint.lintFiles(files);
fs.writeFileSync(new URL('./script-lint.json',import.meta.url),JSON.stringify(results.map(r=>({file:r.filePath,errorCount:r.errorCount,warningCount:r.warningCount,messages:r.messages})),null,2)+'\n');
console.log('errors',results.reduce((n,r)=>n+r.errorCount,0));process.exitCode=results.some(r=>r.errorCount)?1:0;
