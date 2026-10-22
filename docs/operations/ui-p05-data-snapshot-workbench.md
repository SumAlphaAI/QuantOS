# UI-P05 DataSnapshot 目录/详情工作台

沿用UI-204 C04 gateway、runtime、snapshotPolicy与授权失效监控。本轮只改展示、当前页面交互和直接测试；Rust与原245项输入不变，复用54ab042b的reference二进制与原范围证据，不重跑旧Rust/G1闭包。

按P05设计交付统一TerminalFrame/导航/身份上下文、目录表格与本页统计、服务端筛选分页、右侧详情、质量结论、时间窗、Schema/血缘/许可标签、双主题与响应式。实际路由和静态UUID资源映射沿用UI-204。C04未提供分数、覆盖率、dataset字段定义、symbol/provider详情、全局总量、工作流使用数、许可批准范围/到期日或完整中间血缘，不合成设计示例值；sources仅表示来源引用，许可标签不等于用途授权。

所有质量/许可/时效拒绝沿用UI-204，业务提交无新增授权。核对用途仍是重读C04元数据，不创建策略/订单。当前页对比最多两份授权快照，显式点击后串行重读二者，失效/换查询/离开路由清空，不持久化；详情标签支持左右/Home/End键，关闭详情回到原行焦点。复制使用当前授权引用，失败可手动选择，失效后不回填。

“下载元数据”重新读取当前snapshotId，再经C01双上下文与route-access复核，仅导出白名单C04字段JSON（snapshotId/schemaVersion/window/sources/quality/qualityBlocked/contentHash/licenseLabel/capturedAt/maxAgeSeconds/auditRef）。不输出passthrough字段、不含原始数据集、不访问签名外链、不复用C10导出权限；blob URL同步交给浏览器后撤销。仅显式点击，任何不确定/失效状态不自动重放。C04服务端授权读取是前提；本机元数据下载不证明生产许可、跨浏览器接收或目标数据导出验收。

## 当前功能验证

`node scripts/ui-p05-review.mjs --run docs/audit/evidence/ui-p05-local-20261023/attempt-NN`：新目录冻结本机SHA，剥离凭据，执行74项直接单测（19展示/白名单投影及55原策略/runtime）、terminal types/lint/build、13个Chromium（7个P05和6个受展示影响UI-204）、当前门禁/静态路由、计划、联调拒绝和下一UI-201开发入口。前置仅当前功能影响，不把G1辅助项作为开发前置。`--verify`只读检查原命令、源码/产物摘要与边界，不重新执行全链。

视觉基线6张：dark/light × 1672/1024/390。先对实际reference按固定snapshotId服务端过滤，避免随机UUID额外快照的排序假设；只mask实际变化的时间文字和最近读取时间，不改接口响应。六次axe检查记录violations与incomplete原值，自动检查不代表人工读屏/原生200%缩放通过。预检查、初始基线创建与任何失败/中断保留；冻结候选对已提交PNG比对，不在最终验收中更新基线。

保留reference身份EXPLICIT_REFERENCE_COOKIE_BRIDGE与CORS LOOPBACK_PROXY_SUBSTITUTION、Firefox环境阻塞、WebKit拦截附件接收阻塞和所有历史NOT_RUN。真实IdP/MFA、Cookie/CORS、目标数据库、生产托管rewrite、策略/交易提交、跨OS/设备、远程同SHA CI、性能/长稳与发布不准入。确认稿待项目用户，development_status仅IMPLEMENTED_PENDING_ACCEPTANCE，159阶段Gate、G1/FEP-1不提升。下一原任务I2 UI-201。
