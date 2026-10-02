# PRE-06 fixture 与关键风险测试基线

日期：2026-10-02。范围：仓库工程基线；正式 QA/风险/设计/G0 与目标环境签署独立取得。

PRE-04 的 `command-center/default.json` / `stale.json` 是未发布的规划 Inventory Fixture，不属于当前 BFF 成功响应。保留其准备工作范围，在manifest中隔离标注 `inventory-only`，绑定独立的 `PRE04CommandInventory` 本地规划schema，纳入敏感字段与集合验证；MSW正向加载器拒绝将它们作为BFF response使用。该schema不扩充51个wire schema，不冻结未来BFF operation。所有10个JSON必须登记用途、schema与PASS/预期FAIL，新增未知文件直接拒绝。六个契约正向fixture覆盖四个受控resolver的成功/错误分支，两个明确负向样例证明拒绝；两个inventory正向不能被计作provider。未配置的其余operation返回501，62个生成操作不代表62个成功/provider实现。

`tests/critical-branches.json` 冻结当前已实现的五个关键政策文件：路由与写操作守卫、TSX风险/离线提示、危险确认纯逻辑、OIDC回调/会话、审计导出错误与资源隐藏。独立 Gate 对每个文件行/语句/函数/分支均要求100%，不存在全局平均值抵消。DangerConfirmDialog 的授权判断抽取为纯逻辑，公开API保持一致；UI交互仍由组件/浏览器验证。旧全局 TypeScript 行覆盖率80%继续保持，不能替代该 Gate。新增关键风险逻辑须同步清单和负向探针，清单不得缩减既有五项。

两应用每路由初始 gzip 预算为200KB（含polyfills）；另保留共享250KB、单chunk200KB、CSS60KB。必须有完整资源清单和当前源码/配置匹配的构建回执，缺证据不得以0KB通过。预算调整须 ADR 与拆包证据；正式G0与staging计时指标没有被本次静态bundle结果代替。

视觉支持矩阵冻结为Linux/macOS各Chromium、Firefox、WebKit，共24张1440宽PNG。macOS新增七张与既有Chromium基线进行工程视觉对照，原17张字节不变；捕获缺图后必须以无更新模式重放。工程核对不冒充设计owner签署，Linux实际像素验证在对应runner执行。
