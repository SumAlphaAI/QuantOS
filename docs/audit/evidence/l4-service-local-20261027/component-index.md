# 六项原始依赖的来源索引

本表只表示原始内容/Git 输入和 artifact 完整性已核对；全部 ORIGINAL_SCOPE_ONLY、stage NOT_ASSESSED、完整 Gate NOT_READY_GAPS_OPEN。当前候选另由 receipt 与本轮检查绑定。没有运行旧 Gate 或把不同源码结果拼为 READY。

| 原项 | 原源码 SHA | receipt | 当前阶段 |
| --- | --- | --- | --- |
| CORE-GATE:X3 | `07c867ed3df10bd9ede2c3e54cd6730938ae71d9` | [sha256:108ad38050bd084bc63dd7c6ec84c2c310d12e3fba39e8c48a80ef99cda57803](../../../../docs/audit/evidence/core-x3-local-20261026/receipt.json) | NOT_ASSESSED |
| FE:FEP-7 | `a61d22f246dc20011e0e562129e52d1b552df60b` | [sha256:3db3d8f5b30d5e14505d893fc80d531ebcd9ee1c63abe0b18d1e7bd234bd167a](../../../../docs/audit/evidence/fep7-function-local-20261024/receipt.json) | NOT_ASSESSED |
| CORE:L01 | `decf787ff12e1caa2917ad2fd9fcfa8b9496d0b9` | [sha256:d0e8bd00a8d28ab556384ca544ee9d47a313231a104c74506dc049670fc04ffd](../../../../docs/audit/evidence/core-l01-local-20261026/receipt.json) | NOT_ASSESSED |
| CORE:L02 | `379f624b5e45fa4c22231f25ac06ad54f7c049ec` | [sha256:74c89803a74334f4a1ab404f65309f6e776d84a3f15c4e5a8a627de320a4a1fa](../../../../docs/audit/evidence/core-l02-local-20261027/receipt.json) | NOT_ASSESSED |
| SERVICE:L03 | `c276e947d8d326484d1a1f1284272ba20dc7405b` | [sha256:89049389fa4254110a80981966f111c6a2efd0f66f56f0b520a219b2fe8b05dd](../../../../docs/audit/evidence/service-l03-local-20261027/receipt.json) | NOT_ASSESSED |
| SERVICE:L04 | `4bf60cc109e337d618d8a0d73158cc2c8a3f505d` | [sha256:c24d4d70160a269f2b66139e104d5a8415d059a129e6316cbb9b2819c2b23e8c](../../../../docs/audit/evidence/service-l04-local-20261027/receipt.json) | NOT_ASSESSED |

完整机器索引、原字节摘要及代表文件 drift 范围见 [component-history.log](attempt-01/component-history.log)。selectedCurrentDrift 只检查各项指定代表文件，空列表不等于整个组件当前完整源码未变化。历史原始失败、中断和目标 NOT_RUN 保持原范围，不因本次完整性核对而消失。
