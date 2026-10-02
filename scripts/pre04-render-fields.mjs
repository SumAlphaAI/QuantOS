import { writeFileSync } from 'node:fs';
import { loadPre04Inputs } from './pre04-inventory.mjs';
import { renderFieldDictionary } from './pre04-fields.mjs';
const result = renderFieldDictionary(loadPre04Inputs());
writeFileSync(new URL('../docs/PRE-04-field-dictionary.md', import.meta.url), result.markdown);
console.log(`Rendered ${result.fieldRows} field rows; baseline is not modified.`);
