import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const parse=createRequire(require.resolve('license-checker-rseidelsohn/package.json'))('spdx-expression-parse');
export function licenseAllowed(expression,allowed){
 try {
  function evaluate(ast){
   if(ast.conjunction)return ast.conjunction==='or'?evaluate(ast.left)||evaluate(ast.right):evaluate(ast.left)&&evaluate(ast.right);
   return allowed.includes(ast.license+(ast.plus?'+':'')+(ast.exception?' WITH '+ast.exception:''));
  }
  return evaluate(parse(expression));
 }catch{return false;}
}
export const allowed=JSON.parse(fs.readFileSync(new URL('../security/node-license-allowlist.json',import.meta.url))).allowedLicenses;
