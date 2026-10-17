# CORE:TP07 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:TP07",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:f02a51bd12e46711e9384384ca73408299129d0974e256e7b1c5ccc4709af592",
    "sourceCommit": "37922e3d5ad8fd4a9ec7d207f4c5f148d839a037",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

确认对象仅为上述源码和精确输入的TP07功能开发范围：Paper/Shadow LIMIT内核与自有真实Paper子进程、X03当前签名/风险/审批的下游单次消费和事件映射。14组功能/直接影响检查通过，不递归重新验收上游，不将历史READY改绑为新候选结果。完整业务联调和发布NOT_RUN。

| 审阅维度 | 已实现与边界 |
| --- | --- |
| Product | 有效X03命令消费、幂等单提交、事件映射及边界拒绝；Paper默认可替换内核。完整OMS/取消/持久事实归X04。 |
| Frontend | typed trusted-backend API；没有新增页面、公开HTTP或venue提交入口。 |
| BFF | F06 AuthContext、当前X01/S03/财务/venue来源由可信后端解析；仅opaque ID和订单wire进入Paper内核，真实会话/来源联调待验。 |
| QA | 8项TP07消费、4项真实进程/协议、8项X03回归及兼容/静态/覆盖率/门禁/计划检查；1000逻辑任务16worker只提交1次；不是目标性能验收。 |
| Security | 下游→issuer→risk锁顺序、exact HMAC/命令绑定、已消费审批和consumer claim；进程env_clear与私有cwd、严格有界帧、异常隔离；OS级沙箱/生产制品仍待验。 |
| Risk | 每次包括缓存重放复核当前身份/来源/风险/期限/策略/kill；kill CAS不能插入复核与提交之间；未知结果保留claim，不自动重投或切换内核。 |

自有Paper进程不是Nautilus运行时。固定上游仍runtimeAdmission=DENIED，未安装/执行；LGPL分发/法律、真实bridge/API兼容、完整运行时SBOM/最新CVE均待验。线性化与claim是进程内状态；重启/副本/Supabase持久分布式去重、审计、崩溃恢复、不确定提交对账、真实身份/时钟/来源/OS隔离、安全/性能/长稳及同SHA CI等26组目标NOT_RUN。观测时间必须来自可信后端，不接受客户端自报为权威。

X03旧独立READY因输入变化撤回，原manifest与历史记录不改写；本轮X03回归只属于TP07影响验证。早期编译/审计fixture/计划编辑/采集不足失败与自动审查超时记录保留，修复后实际功能范围重新记录。

本稿PENDING，formalAccepted=false。ProjectUser可在本会话确认或修改；Codex保存真实原始答复、时间、唯一确认人、文稿及范围摘要后独立执行门禁。无需六份角色回执，不自行批准。确认也不替代未执行目标，不授予生产或外部发布权限。
