import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {installReferenceHooks,authorized,useSession,control,zoneSnapshot,networkRows} from './fixtures/frontend-g8-reference';
installReferenceHooks('assisted-mtls-local',false);
test('CORE L4 default off refuses public command and exposes no high risk actions',async({page},info)=>{
 useSession('session-current');for(const path of ['/approvals','/orders']){await page.goto(path);await authorized(page);await expect(page.getByTestId('assisted-native-condition')).toContainText('暂未开放');await expect(page.getByRole('button',{name:/发起双人审批|独立审批并验证 MFA|提交已双人批准/})).toHaveCount(0);}
 const denied=await control('/v1/assisted-testnet/requests/11111111-1111-4111-8111-111111111111/commands',{expectedRevision:2},undefined,{session:'session-current',method:'POST'});expect(denied.status).toBe(403);expect(zoneSnapshot()?.protocolCalls).toBe(0);expect(networkRows().filter(r=>!r.control&&r.method==='POST')).toHaveLength(0);
 await writeFile(info.outputPath('core-l4-off.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,serverFlag:false,publicStatus:denied.status,uiHighRiskActions:0,nativeProtocolCalls:0,zone:zoneSnapshot(),actualTestnetConnected:false},null,2));
});
