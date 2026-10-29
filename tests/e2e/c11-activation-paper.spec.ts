import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {installReferenceHooks,useSession,authorized,networkRows} from './fixtures/frontend-g8-reference';
installReferenceHooks('paper');
test('C11 mode entry preserves existing Paper administration catalog without mutation',async({page},info)=>{useSession('session-owner');await page.goto('/admin/flags');await authorized(page);await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'C11 执行启用',exact:true})).toHaveCount(0);await expect(page.locator('main')).toContainText('alerts-live-view');expect(networkRows().filter(r=>!r.control&&r.method!=='GET')).toHaveLength(0);await writeFile(info.outputPath('c11-paper.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,mode:'paper',legacyCatalogVisible:true,noBrowserMutations:true,actualTestnet:false},null,2));});
