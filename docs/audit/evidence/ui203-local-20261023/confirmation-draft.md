# UI-203 当前功能完整确认稿

状态PENDING；唯一确认人为项目用户，Codex拟稿与核对，不代用户批准。仅确认I2 UI-203当前功能与明示本机reference组合，不申请G1/FEP-1、INTEGRATION READY、运行或发布准入，不作为UI-P04开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-203",
    "stage": "INTEGRATION",
    "sourceCommit": "03ecbdfa31d075a821cabe6e278c65131e25cde9",
    "inputsDigest": "sha256:15e2094271d2b434f738378db72e9d2c0a100fea84eee970df1be377653ef182",
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
  ],
  "approver": "ProjectUser",
  "decision": "PENDING"
}
```

工程候选 `03ecbdfa31d075a821cabe6e278c65131e25cde9`，593输入，摘要 `sha256:15e2094271d2b434f738378db72e9d2c0a100fea84eee970df1be377653ef182`；46产物、10条命令。见[工程回执](./receipt.json)、[范围](./scope.json)、[原始执行](./attempt-01/executions.json)、[视觉核对](./visual-review.json)、[报告](../../UI-203-current-function-review-2026-10-23.md)。预检失败与原始incomplete均保留，不拼接为最终候选通过。

- Product：交付`/artifacts/:artifactId`及带artifactId/runId/evidenceId的查询入口、Artifact元数据/假设/摘要/版本/内容和环境哈希、研究Evidence选中态与所属Artifact/父Research/快照/审计交叉跳转。inputHash取已核对成员与snapshot/hash一致性的C03父Research，或校验格式的C04可选字段；直达缺失时明确未提供，不用contentHash替代。没有产物目录API，不虚构目录。lineageRefs仅显示未定义类型的引用，不猜测链接。研究evidenceId与C10 eventId分别展示。
- Frontend：复用原C03/C04/C10网关、身份加载和route-access；UUID规范化、冲突/重复/未知查询键拒绝。Evidence从父任务最多20个Artifact中定位唯一所属产物，核对成员/evidence/快照和输入哈希；C04 evidence扩展最多200条，拒绝跨产物/重复/异常引用。元数据不可变字段变化拒绝；归档JSON显式读取、重读元数据并绑定artifactId/contentHash、JSON媒体类型与262144字符上限，React纯文本显示，不执行HTML/脚本或内容链接。Research/Audit只按已知对象kind和UUID生成目标，不跟随任意服务端route。预览区有命名region与键盘可滚动区域。
- BFF：后端/契约、原gateway/runtime/policy、共享SSE未变，245Rust输入未变，原e3776999 reference二进制直接复用，不重建/不重跑Rust或上游全链。实际reference预置Artifact明确synthetic，元数据/归档/审计/快照读取经过真实C03/C04/C10处理；父Research种子真实创建，但artifactRefs/evidenceRefs与Evidence摘要关系注入均标明合成，不冒充worker/引擎完成。分页夹具在浏览器记录synthetic游标，向上游reference重读时去掉该合成游标，结果分页另行标明合成，不冒充真实签名游标或目标环境验证。
- QA：同候选76单测（60 UI203+8 Research网关+8 Audit网关）、12Chromium、67门禁/路由、types/lint/build及94文件客户端检查通过。两主题×1440/390的4截图与4次axe零violations、零新增incomplete；未作UI-P04图像基线比对。首轮74/75发现429重复点击错误延长冷却，已修；11/12浏览器中的分页夹具被真实reference正确422拒绝，修正夹具并单项复测后完整冻结验证。预检4条aria-prohibited-attr incomplete由pre缺少支持aria-label的role引起，当前role修正后扫描为0；历史报告保留。通用artifacts忽略规则已加源码专用例外，门禁确认源码纳入593输入。
- Security：持续授权保持原5秒检查/最长8秒未验证窗口，C01重读/固定scope/MFA和research.read；C10另需audit:read且只查当前Artifact/父Research明确返回的correlationId。C10每页100、最多20页/2000节点，重复、乱序、游标循环、complete矛盾与retention失效拒绝；资源deadline绑定页面。401/403、撤权、离线、隐藏/失焦、scope/到期清空元数据/预览/关联链并中断在途请求。恢复只重读元数据，不重放预览或写入，状态仅内存；浏览器业务交互无POST，服务端可追加读取审计，关系测试仅Node控制reference种子。429冷却不因重复点击延长，不自动重试。
- Risk：保留reference身份/CORS loopback/自签TLS替代、Firefox环境阻塞、WebKit附件拦截接收阻塞、原6图标+2表头及UI-P03十二条color-contrast incomplete与历史ledger全部NOT_RUN；P03控件跨扫描重复，不等于12独立缺陷。实际引擎产物/Evidence、真实IdP/MFA/Cookie/CORS、目标数据库/Storage、provider、生产host、远程同SHA CI、性能/长稳/发布、人工读屏/原生200%缩放/跨OS均NOT_RUN。哈希按owner返回并绑定，未独立重新计算归档canonical bytes或执行密码学签名验签；complete仅当前授权范围。C04未返回inputHash/研究证据时明确缺失，不扫描所有任务反查，不将元数据读取权限当作业务/策略/交易用途许可。

计划IMPLEMENTED_PENDING_ACCEPTANCE，人工确认PENDING；159阶段Gate保持NOT_ASSESSED，G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。不将G1辅助项作为前置，不重复全链。未使用生产凭据、推送或部署。下一原任务I2 UI-P04可继续开发。
