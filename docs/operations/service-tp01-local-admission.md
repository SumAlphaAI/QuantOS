# SERVICE:TP01 本地服务功能汇总准入

`SERVICE-TP01_LOCAL` 只发布 `SERVICE:TP01` 的 DEVELOPMENT READY；A–G 与 R1-SERVICE 的完整31节点必要闭包在同一清洁冻结候选实际执行，内部 LOCAL_READY 只属于本消费者。历史单项 READY 或旧回执不能代替本轮执行。其他全图Gate保持原状态，TP01正式ACCEPTED与页面联调不在此次范围。

专用132条真实本机UDS/隔离启动测试逐一绑定案例ID：100个安全边界负向fixture、20个workflow、Artifact幂等/跨租户去重、取消完成小于2秒且零晚写、五个RPC、其他engine在屏蔽adapter导入后启动、6个unary/stream禁用/回滚/告警在途撤销、重复回滚与提交边界禁用。既有A–G原始检查同时重跑：包括三次独立跨语言构建、S0–S3分类阻断、19项本机drill、198项模块替换、固定基线上游patch原件预期2失败/修复后4通过。上游仅DRAFT_NOT_SUBMITTED，不调用远端。

`node scripts/service-tp01-functional.mjs --record` 记录专用功能证据，不能单独授予READY。Node负向测试验证实际回执的缺项/重复/篡改/跳过/失败、候选混用、权限扩大与发布失败恢复。冻结源码、契约、配置和本规程到Git后，从清洁树执行 `make service-tp01-assess-local`；重试须传新 `docs/audit/evidence/provider-a1-remediation-20261004/service-tp01-local-20261015/attempt-NN` 给记录器。所有数据库/外部凭据从执行环境移除，工具离线；不创建本机数据库。

记录器保存原件/生成件后恢复历史canonical；失败仍保存原始日志。完整本地index内容与哈希通过后，汇总manifest从同次执行派生指标、来源和依赖摘要，事务性更新计划与自身manifest；写入或后验失败恢复所有旧字节。`make service-tp01-local-check` 复验；`make service-tp01-release-check` 在目标或正式证据缺失时必须拒绝。

放行仅满足TP06的SERVICE依赖，TP06其他依赖仍需当前候选证据。22组共享目标以及7天真实canary、目标回滚≤5分钟、正式验签、持久审计/跨进程恢复/控制授权、真实监测/影子消费、目标模块组合/Artifact/恢复、性能/长稳及同SHA hosted CI移交RELEASE-GATE:BETA，全部NOT_RUN；Web Research页面E2E归CORE:TP01/U01。合成fixture authority、内存Artifact/审计、受控时钟、UDS和离线patch不替代目标验收。发布控制/后端事务与补偿仍由目标实现验证。formalAccepted=false，production=false，externalPublished=false，upstreamAccepted=false；ProjectUser正式确认遵循统一规程，本轮不自签。
