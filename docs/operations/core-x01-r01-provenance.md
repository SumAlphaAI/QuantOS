# CORE:X01 DEVELOPMENT / L4-R01-VALUATION-PROVENANCE-01

本任务承接[最新 L4](./core-l4-source-review-assessment-20261030.md)，将批准的 R01 标准化事件/F03 DataSnapshot 产物通过独立当前授权与签名，接到当前不可变账本的 mark / 风险快照、新风险/Subject 和 IO 前复核。基线 `f494a59fdcca25063abdb2156cb6afc02f5ec240`，具体冻结源码/输入/执行见[证据](../audit/evidence/core-x01-r01-provenance-local-20261030/README.md)。旧 L4 `999510195a763e26ed50a49121765d48eb2bef07` 的1934输入/44原始文件保留原Git blob/hash与ORIGINAL_SCOPE_ONLY。

## 来源、用途与资金授权

`quantos-portfolio::market_provenance` 提供 Policy、Artifact/SignedArtifact、Binding、Summary 和追加式 History。产物由真实 `quantos-market::MarketIngestor` 规范化 RawMarketTick，构建 F03 DataSnapshotRecord，保存事件 canonical hash、不可变 artifact ref、lineage、schema/quality/window/tenant。消费时再次重算 R01 规范化事实、F03 完整性、Trading 质量 Gate 和 SnapshotSourcePolicy；不是信任 sourceRef/许可标签字符串。

当前批准 Policy 是独立 owner MAC 认证输入，不来自 HTTP 请求或签名产物自声明；钉住 tenant/workspace/account、用途 assisted_testnet_valuation、Trading 许可、provider/dataset、批准引用/版本/文档hash、scope hash、symbol集合、价格精度、期限及签名者指纹。签名产物使用独立 `quantos-r01-valuation-artifact-signature/v1` 域，绑定 Policy hash、原完整 raw valuation input hash、scope、连续 version/previous hash、R01原始tick与事件、F03 snapshot。X05/observer签名不能替用；PEM必须匹配 owner 启动钉住的指纹，并满足当前证书有效期和批准截止。

价格只从已核对的 R01 event Quantity / raw decimal 精确派生，拒绝无批准/过期/撤销/用途不符/错账户或symbol/精度溢出/未来/不健康/缺失/篡改/分叉或回退。不得从成交价、平均成本、现金、旧快照或空值补 mark。MarketEvent 的历史规范化使用显式 observed_at 批准时钟；原 live approved_provider() 仍使用当前时钟，过期 live provider 不复活。

**资金和账户状态仍为独立 owner 参考授权。** Inputs.sourceId、basis/期初现金/状态语义保持，Snapshot.sourceTrust 仍 OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET；新增 optional marketProvenance 只说明当前 mark 的认证来源。其 trust 明确 AUTHENTICATED_R01_F03_TRADING_ARTIFACT_OWNER_PINNED_NOT_LIVE_VENUE，不授予真实市场许可、资金真实性或订单权限。默认自有 fixture 的批准文档/证书是测试参考，不冒充实际许可/真实 venue。

## 当前复核、版本和恢复

owner 临时配置新增默认关闭 `r01ValuationEnabled`。开启后 raw valuation input 的 marks 必须为空、不得自行携带 marketProvenance；BFF从独立认证 `market-valuation-policy` 和私有 `r01-valuation-artifact.json` 读入并派生。原未启用的 owner mark 端口保留原范围兼容；一旦当前市场模式被观察/持久化，去掉标志、文件或批准都不能回退旧参考mark/缓存。

Policy/Artifact 当前 head 在原认证审批 checkpoint 的 valuation.marketHistory 追加。版本从1连续、钉住 previous hash、同版本内容不变、时间不倒退。撤销/不健康的**认证**新head即使拒绝消费也保留，冷恢复后不能重放旧授权/健康文件。坏签名不被当作可信新head；文件仍在时拒绝，不用缓存兜底。历史快照/旧命令只在原生成时刻按原输入/批准/证书重算，当前撤销不重写历史。验证前缀延伸、完整持久来源引用及认证签名；整个目录/密钥被同一owner回滚仍不是外部单调锚，目标义务保持。

沿用原 512 sources/snapshots 上限；新增领域上限64 policy、64 artifact、16 ticks/产物、262144产物字节、价格scale≤18，拒绝超限。原风险限额、UNKNOWN义务、generation及Proposal/snapshot一次性预算不放宽或重置。R01原批准新鲜度仍生效，并与原估值30秒、F03窗口、policy/provider/许可/证书、账户/资金和UTC日终取最小半开截止；读取、复核或恢复不刷新原时间。受控fixture显式批准新鲜度30秒，生产默认2秒未改变，发布性能测试原ignore保留NOT_RUN。

## 原子性与 IO

共同审批锁下，当前 mark 来源复核复用稳定的 `account-books-fence`。publisher 在该锁下替换 Policy/Artifact，BFF新风险、open/MFA和IO前均读当前值；native预留/fsync/IO整个窗口持有 fence。原 raw valuation input 锁在 IO 内同时保留，raw input hash不同即拒绝跨来源混合。publisher更新原资金输入必须独立使用 valuation-input 锁；Policy/Artifact发布不在持有fence时反向获取valuation-input，避免逆序锁。输入先后发布中间不一致只会拒绝，不形成新快照。BFF其他路径的锁调用区分 locked/unlocked，避免重复获取同一inode锁。

R01 Binding完整进入持久 Inputs，新 Summary进入 Snapshot，二者包含于现有 X02 signed facts。public risk/新Subject.nativeRiskBinding/Command.currentRisk和C10记录同源 Summary/hash，IO前重建和比较精确快照，当前许可或产物变化即拒绝旧审批。新风险仍绑定同一不可变Proposal，仍需公共独立双审批和C11/kill条件；没有新submit通道。

UNKNOWN先拒绝可用估值，不构造部分现金/exposure快照；已保留命令只查询。实际已认证R01命令在IO后BFF丢响应，经公共kill/独立解除和冷恢复保留原 generation0、来源证明、签名/claims、1已知入账/1隔离、原4加3未知相关OPEN共7条，不补发或自动关闭。

## API、Terminal 与验收

API 1.32.0 / 160 operations / 179 schemas，新增 R01ValuationProvenance；Snapshot、当前估值/风险、新Subject binding与原生Command binding只增optional字段。旧None序列化/hash与历史签名形状不变。生成client/Zod/MSW/input-policy与PRE-04同步，1083字段行。Terminal核对 Summary与精确Snapshot/新风险/Subject/Command一致和原期限，展示mark provider/dataset/批准版本/用途/截止，并明确账户资金仍参考；不新增隐式评估或重试。

当前功能与直接回归包括R01规范化、F03授权、估值/高水位/风险签名、公共审批/IO/冷恢复和消费者。共享估值函数、输入/快照序列化及源锁影响原core_l04的51项，因此只在冻结候选上补跑该文件51项直接回归；不递归全上游/全仓/F05F07或发布campaign。R01既有发布性能ignore单独保留，不声称通过；未连接数据库，不属于Supabase验收。

工程Gate目标 PASS_CURRENT_AUTHENTICATED_R01_MARK_PROVENANCE_RISK_SNAPSHOT_IO，以冻结结果为准。功能IMPLEMENTED_PENDING_ACCEPTANCE，完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19gaps/8规划义务OPEN、159规范阶段与原200venue/50授权旅程/4目标演练等分母不变；fullBooksReady/dayCloseAllowed/executionAuthority=false。

真实许可live R01/持久部署流、资金/账户全集、Research/R04、IdP/MFA/Supabase/Vault/RLS/跨主机/外部锚、签名轮换/多provider混合、异步成交/FX/非报价币费用/外部流/负债/在途预算、通知/源关闭、目标安全容量长稳同SHA CI/发布及当前人工浏览器/无障碍均未验收或NOT_RUN。只使用自有临时证书、fixture批准、真实仓库模块和loopback，不读取生产凭据或访问真实provider，不推送/部署/外部发布。

下一 CORE-GATE:L4 DEVELOPMENT：评估R01认证产物mark加入来源/财务审查、X02/X04/X01/X05/X06和公共kill/C11后的当前组合与剩余缺口。
