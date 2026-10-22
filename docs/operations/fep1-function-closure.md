# FEP-1 功能收口与执行边界

本规程落实项目用户2026-10-22的纠偏指令，优先于旧G1报告、整改账本或规程中的“下一G1-DEP-01”等执行建议。旧原稿、确认、失败和技术证据保持原字节；改变的是当前调度方式，不是历史结果。

FEP-1是I1原计划里程碑，包含官网首期、P01/P02/P15/P17、App Shell、路由、主题、i18n与全局状态。本次执行这些既有功能的收口，复用DL/REC整改和原页面证据，不先执行G1-DEP-01、不要求26项依赖重新READY、不要求P15补签、Firefox/WebKit或目标环境清零后才开始开发。依赖适用性随FEP-1范围/影响登记完成，不另生新的开发前置任务。G1-DL/REC等编号属于发现项/整改记录，不加入主计划任务图。

实际入口：`pnpm check:development-execution FE:FEP-1`；执行限定验证：`pnpm assess:fep1:function docs/audit/evidence/fep1-function-local-20261022/attempt-NN`；复核：`pnpm check:fep1:function`。执行器读取`development-testing-policy.json`和`docs/execution/development-followups.json`；开发不检查依赖READY或历史人工确认，但已登记的未修复当前功能/权限/恢复缺陷必须拒绝其受影响任务，不能以“允许继续开发”为由忽略。下一原计划功能项UI-507同样可进入开发。

`pnpm check:fep1:integration`是独立阶段检查，当前应拒绝，因为FEP-1/G1仍INTEGRATION NOT_ASSESSED。发布必须走冻结候选发布验收，本入口始终不授发布。原depends_on与阶段READY校验保持，功能执行不修改159项stage_gate，不授上游、I2联调、运行或发布READY。

本次应用源码未改，Terminal/共享模块/reference产品代码与38569928相同，复用原10条本机端口替代旅程、30 Rust及旧DL/REC证据；不重建、不重跑浏览器/后端/full-chain。对官网内容/访问申请、壳导航、主题/i18n基础、七态和认证守卫补直接功能测试与两应用typecheck。旧UI103共享组件及官网generated消费者有历史输入变化，因此在本轮选取当前组件/网站消费者测试，不能把旧源码的截图或浏览器测试重新声称为当前SHA通过。完整页面英语切换、真实身份/通知、人工读屏/原生200%、完整目标/浏览器矩阵仍按原范围保留，不扩大当前i18n基础能力声明。

边界：IdP/session仍为本机替身，导出创建仍NODE_CONTROL_PORT；Firefox环境、WebKit拦截附件阻塞及所有历史NOT_RUN/incomplete/失败保持。P15原稿确认仍PENDING；FEP-1功能收口完成不代替P15确认或完整联调/发布接受。下一主任务是I2原计划UI-507的功能开发，G1-DEP-01等不再被推荐成必经步骤。无生产凭据、目标连接、推送或部署。
