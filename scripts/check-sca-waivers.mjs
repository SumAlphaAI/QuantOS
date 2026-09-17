import {readWaivers} from './sca-policy.mjs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
console.log(`Validated ${readWaivers(root).length} exact, unexpired SCA waivers.`);
