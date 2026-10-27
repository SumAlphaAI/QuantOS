import {test,expect} from '@playwright/test';
import {installReferenceHooks,authorized,networkRows} from './fixtures/frontend-g8-reference';
installReferenceHooks('assisted-local',false);
test('CORE L03 server flag off removes actual P10 and P11 native actions',async({page})=>{for(const path of ['/approvals','/orders']){await page.goto(path);await authorized(page);await expect(page.getByTestId('assisted-native-condition')).toContainText('暂未开放');await expect(page.getByRole('button',{name:/发起双人审批|独立审批并验证 MFA|提交已双人批准/})).toHaveCount(0);}expect(networkRows().filter(r=>!r.control&&r.method!=='GET')).toHaveLength(0);});
