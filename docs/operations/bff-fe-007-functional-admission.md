# FE:BFF-FE-007 当前功能准入

按最新AGENTS.md，A2_AUDIT_LOCAL只复核C10六操作：审计搜索、因果链、导出创建/状态/取消/下载metadata。F05只验证append-only/provenance/tenant/correlation/causation及checkpoint直接边界；A1只检查当前OpenAPI六类生成产物，BFF-FE-001回执在修改前保存并核验。前任务的原始用户确认绑定原85530021/4f261e67范围，见[纯文稿确认兼容](./committed-prose-confirmation.md)。三项直接依赖reference-only，不递归重授READY，不拼接旧回执。

17组检查覆盖当前契约/旧严格证据拒绝、生成、F05静态与两个直接纯行为、实际Audit provider及共享identity回归、共享audit_core纯策略、真实Rust loopback六API与401/403/410、实际生成consumer丢响应同键恢复/资源绑定/超时取消、八类真实源码变异、TypeScript/lint、原确认与新门禁负向及计划/CI策略。全仓、上游闭包、无关Web构建、三轮独立构建不在本轮范围。

先提交源码，再运行`node scripts/record-bff-fe-007-functional.mjs docs/audit/evidence/bff-fe-007-local-20261018/function-attempt-NN`；必须新attempt目录。门禁绑定真实Git blobs/规范计划输入、精确命令/日志/时间退出状态与HTTP/变异产物摘要。变异只在临时workspace offline裁剪锁副本；剩余包身份/版本/source/checksum属于原锁子集，原锁不变，实际测试--locked且只有预期业务断言exit101才算拒绝。凭据环境白名单、公开local-mock模板、单Rust job；无本地数据库、目标连接或真实IdP。

`pnpm check:bff-fe-007:development`与CI识别当前限定回执，由同一内容验证器检查；激活后开发CLI、CI、原用户确认CLI及双计划检查失败则回滚manifest和stage_gate。旧configured-Supabase严格验收代码保留历史，不代替本轮执行。功能PASS仅授予本任务DEVELOPMENT READY，当前任务用户确认仍PENDING。

reference修复包括独立导出correlation/因果根、稳定HTTP/audit关联与retention一次过期转换；consumer新增请求资源ID绑定及可取消/可设超时，未知写入不自动重试，调用方使用原幂等键恢复。实际SQL/live持久实现未改；无新Supabase/RLS/真实worker lease重启/存储对象/票据并发消费证据，统一NOT_RUN。完整十页面/API业务链、目标规模五分钟还原、跨浏览器/部署/性能/长稳/同SHA hosted CI和正式确认留INTEGRATION/RELEASE，PROVIDER:A2/G5/FEP-5及runtime独立未准入。
