# I2 UI-P12 当前高保真页面完整确认稿

状态 PENDING，唯一确认人为项目用户。Codex拟稿、验证技术证据和记录，不代用户批准。本稿仅确认原I2 UI-P12的当前页面功能与明示本机reference组合，不申请INTEGRATION READY、运行或发布许可，也不作为下一原任务UI-204的开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P12",
    "stage": "INTEGRATION",
    "sourceCommit": "8f1f376372a2b5b12a5e2477b746f5940e78a06d",
    "inputsDigest": "sha256:790d67107c990634318681196bfbbc529276773bc25e7133e74aae937fae447b",
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

工程候选 `8f1f376372a2b5b12a5e2477b746f5940e78a06d`，540项输入，摘要 `sha256:790d67107c990634318681196bfbbc529276773bc25e7133e74aae937fae447b`。见[技术回执](./receipt.json)、[实际执行](./attempt-01/executions.json)、[范围](./scope.json)、[报告](../../UI-P12-current-page-review-2026-10-22.md)。校验工具单独修复于 `6bb2d19a924692f0a48c39e3c903a59b6596c452`，仅门禁文件的Git设计PNG缓冲区与同SHA证据续核入口；不改产品/测试源码，不把工具提交或后续证据HEAD声明为已验收产品候选。原10项执行及原输入/产物保留原SHA，没有拼接不同候选PASS。

1. Product：按P12 v1设计交付筛选/结果/因果时间线/事件详情和导出任务抽屉，实际/audit、/audit/:correlationId、/exports/:exportId；保留旧query入口。主搜索、服务端排序/游标分页、固定/清除本页筛选、当前授权范围计数与完整性语义、状态/过期/下载可用。未提供的全局数量、签名通过、root hash、百分比与真实健康状态不编造。
2. Frontend：共享Terminal chrome及冻结字体/色彩/focus，P12作用域布局与深浅主题；1672/1024/390六张Chromium/Darwin基线、1440重排和实际导出页截图。详情tab左右键、抽屉关闭/恢复焦点、引用复制拒绝回退及移动查询；小屏无创建/取消高风险操作。7态故事仅为呈现；默认/加载/空/错误/无权/离线有直接路由用例，期限拒绝复用runtime直接单测，陈旧视图故事不作为新增浏览器期限验收。
3. BFF：复用UI-507生成C01/C10、runtime/gateway与已确认原证据。MFA/近期认证/CSRF/幂等、未知结果原意图显式重试、取消前重读、202非最终、授权失效清屏/Abort/显式恢复保持。Rust源码245输入不变，复用原9f7552a8的精确reference二进制；canonical静态别名只映射声明UUID资源族，客户端拒绝冲突/非法引用。托管重写示例不等于目标部署通过。
4. QA：同一工程10项命令均达预期（联调入口1项预期exit1）；46单测、14 Chromium（8 P12/6受改版影响UI-507）、49门禁/路由、类型/lint/一次候选Terminal构建/秘密扫描/计划通过。6次axe零违规，6项incomplete原样保留；人工读屏/原生200%仍NOT_RUN。6张固定基线按候选比较，retry/skip/flaky=0。真实附件4743字节，其sha256与本轮租约和内容响应一致。预检与首次封装失败保留，修复后仅重复49项工具/路由检查和门禁lint，未复跑功能、构建或浏览器。
5. Security：reference身份cookie与CORS仍为明确替代端口，实际API/内容原字节透传且URL不重写；只读收窄、延迟和503为独立明示合成边界。短链遵循C10最长300秒及会话/保留期，不能按设计图10分钟放宽；URL不入状态/存储/复制或日志。引用复制需要手势并检查访问；服务端route仅文本，不自动导航外部地址；后台作业与MFA令牌不持久化。
6. Risk：Firefox环境阻塞、WebKit拦截附件接收阻塞及原账本全部NOT_RUN原字节保留。真实IdP/MFA、cookie/CORS、DB/storage、目标持久撤权、跨OS/设备、远程CI、性能/长稳、生产TLS/托管重写与发布未验；C10签名链独立验签未执行。未知意图只在当前页内存恢复，离开后先查审计事实。旧UI-507/G1确认不改绑当前页或新HEAD。159个阶段Gate不提升，G1/FEP-1仍有原缺口，formalAccepted=false、runtimeAdmission=DENIED。

## 唯一确认范围

仅上述工程SHA/输入摘要、完整稿、报告/技术回执以及明示校验工具修正的UI-P12当前页面范围。没有用户确认原始答复，approval=null；执行指令不等于批准本稿。本稿不授予生产凭据、推送、部署或对外发布，不将NOT_RUN/阻塞转成PASS。下一原任务UI-204开发允许，不要求先关闭G1辅助项或本稿待确认。
