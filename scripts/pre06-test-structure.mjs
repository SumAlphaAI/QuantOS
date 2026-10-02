import ts from 'typescript';

function calls(text) {
  const source=ts.createSourceFile('spec.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const result=[];
  function visit(node) {if(ts.isCallExpression(node))result.push(node);ts.forEachChild(node,visit);}
  visit(source);return result;
}
function hasAssertion(callback) {
  let found=false;
  function visit(node) {
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&/^to[A-Z]/.test(node.expression.name.text)) {
      const expression=node.expression.getText();if(expression.startsWith('expect('))found=true;
    }
    ts.forEachChild(node,visit);
  }
  visit(callback);return found;
}
export const requiredContractTests=[
  '故意破坏 schema → 校验失败','故意破坏权限不变量（executable=true）→ 校验失败','故意注入敏感字段（venueApiKey）→ 校验失败',
  '未配置 operation 默认返回 501 且不伪造成功 fixture','版本冲突返回 409/currentVersion，客户端不得静默覆盖',
  'MFA 限流返回 429/retryAfter 且不泄露账户存在性',
  'all declared positive/negative fixtures match their schema and purpose',
  'equivalent forbidden keys are rejected recursively without rejecting public fields',
];
export function validateTestStructure(contractText, visualTexts) {
  const failures=[];const all=calls(contractText);
  for(const name of requiredContractTests) {
    const test=all.find(call=>call.expression.getText()==='it'&&ts.isStringLiteral(call.arguments[0])&&call.arguments[0].text===name);
    const callback=test?.arguments[1];
    const expectedCall=/未配置|版本冲突|MFA 限流/.test(name)?'fetch':name.startsWith('all declared')?'validateFixtureInventory':'validateFixture';
    const executableCalls=callback?calls(callback.getText()):[];
    if(!callback||!hasAssertion(callback)||!executableCalls.some(call=>call.expression.getText()===expectedCall))failures.push('missing executable contract assertion: '+name);
  }
  for(const [file,text] of Object.entries(visualTexts)) {
    const expected=file==='ui104-settings.spec.ts'?2:1;
    const actual=calls(text).filter(call=>ts.isPropertyAccessExpression(call.expression)&&call.expression.name.text==='toHaveScreenshot'&&call.expression.expression.getText()==='expect(page)'&&call.arguments[1]&&ts.isObjectLiteralExpression(call.arguments[1])&&call.arguments[1].properties.some(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText()==='maxDiffPixelRatio'&&prop.initializer.getText()==='0.005'));
    if(actual.length!==expected)failures.push('missing executable visual assertions: '+file);
  }
  if(Object.keys(visualTexts).length!==3)failures.push('missing visual spec inventory');
  return failures;
}

function objectProperty(object,name) {
  return ts.isObjectLiteralExpression(object) ? object.properties.find(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText().replaceAll('"','').replaceAll("'",'')===name)?.initializer : undefined;
}
function source(text){return ts.createSourceFile('config.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);}
function configObject(text){const call=calls(text).find(call=>call.expression.getText()==='defineConfig');return call?.arguments[0];}
export function configValue(text,path) {
  let value=configObject(text);
  for(const key of path)value=value&&objectProperty(value,key);
  return value?.getText().replace(/\s/g,'');
}
export function projectNames(text) {
  const object=configObject(text);const array=object&&objectProperty(object,'projects');
  return array&&ts.isArrayLiteralExpression(array)?array.elements.map(entry=>objectProperty(entry,'name')?.text):[];
}
export function budgetValue(text,key) {
  let value;
  function visit(node) {
    if(ts.isVariableDeclaration(node)&&node.name.getText()==='BUDGETS')value=objectProperty(node.initializer,key);
    ts.forEachChild(node,visit);
  }
  visit(source(text));
  if(value&&ts.isBinaryExpression(value)&&value.operatorToken.kind===ts.SyntaxKind.AsteriskToken&&ts.isNumericLiteral(value.left)&&ts.isNumericLiteral(value.right))return Number(value.left.text)*Number(value.right.text);
  return undefined;
}
export function hasCall(text,name){return calls(text).some(call=>call.expression.getText()===name);}
