# FE:UI-P17 / I1 当前页面功能完整确认稿

状态 PENDING。唯一确认人为项目用户，Codex拟稿、验证技术事实和记录，不代用户批准。本稿仅确认当前页面范围，不申请INTEGRATION READY、运行或发布许可。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P17",
    "stage": "INTEGRATION",
    "sourceCommit": "dae4d0148439ea06d871caab74d7f2403a36a33a",
    "inputsDigest": "sha256:38dacecae2942f76596f55d380366741f0e0005fcefc0fabb01a2880caeef500",
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

冻结工程 `dae4d0148439ea06d871caab74d7f2403a36a33a`，1328项输入，`sha256:38dacecae2942f76596f55d380366741f0e0005fcefc0fabb01a2880caeef500`；见[机器回执](./receipt.json)、[实际执行](./function-attempt-01/executions.json)、[报告](../../UI-P17-current-function-review-2026-10-22.md)、[尝试历史](./attempt-history.json)。后续文档/证据提交不等于新HEAD接受。16项前提只引用原需求，不递归复验或重授READY。

1. Product：P17高保真v2的Web浏览器通知、下载、站点存储、深链、响应式和兼容说明已落地/settings/browser。原生API、权限、服务端声明与已验证事实分列；不将静态CSP/Cookie/SRI声明冒称已验收，不纳入Desktop/原生文件或硬件能力。
2. Frontend：browser作用域CSS、冻结tokens、深浅主题/密度和可访问性偏好；1440/1024/390、键盘、CSS zoom=2与三位置六张本机基线；日期截短但完整值保留。12组axe违规0，incomplete 12项保留。人工读屏、原生200%、跨OS/browser像素比较NOT_RUN。
3. BFF：生成C01/C17 client/schema守卫、按需读取与最早有效期；policy不能授予原生权限或领域能力。下载有界分页与精确源记录、手势短链、opaque ticket、origin/格式/期限/取消后复核。实际参考API创建内存导出并原字节桥接读取，安全响应仅hash；viewer audit:read不足403、invalid401和参考不可信lease拒绝均验证。真实投递与目标Cookie/CORS/DB/IdP仍NOT_RUN。
4. QA：冻结工程17命令退出0，92单元/组合、66门禁/边界及56浏览器案例通过，retry0/skip0/flaky0；48项基线登记完整，8图当前比较仅Chromium/Darwin。Firefox独立环境失败，WebKit拦截附件事件失败，不把诊断退出0或导航200当附件功能PASS；完整失败/超时与首轮日志覆盖边界明确记录，冻结结果独立。
5. Security：CSRF/身份/权限仍由既有服务守卫；本地权限不授业务权，401清理/安全重定向。仅精确短语删除一个布局键，不扫描秘密、不清Cookie/其他存储，失败不确认清除。深链无账户/token、固定本站安全return_to与noopener/noreferrer，复制拒绝手动回退，下载租约不持久化/日志化。重复点击、离线、重载、卸载及最终期限拒绝验证。
6. Risk：当前功能工程与限定组合不代表G1完整业务闭环、目标联调或发布。小屏高风险限制与Web-only不扩大；目标下载origin兼容、参考签发URL差异和WebKit附件接收是未决边界。保留全部NOT_RUN，P01/P02确认与P15待确认不改绑。禁止以本稿授权生产凭据、推送、部署或对外发布。

## 保留的阻塞与未执行

Firefox 独立启动10秒超时，环境 BLOCKED_ENVIRONMENT，浏览器功能 NOT_RUN。WebKit 在产品外独立验证真实环回HTTP附件可接收，同源及HTTPS route.fulfill附件均200但下载事件超时；当前产品WebKit只验到签名内容响应，拦截附件接收 BLOCKED_ENVIRONMENT_TEST_INTERCEPTION / NOT_RUN。三次原超时和最终诊断保留；Chromium附件实际落盘4字节与fixture一致。不能将WebKit导航成功当附件交付成功。

Rust reference 原下载租约是 downloads.invalid/query-ticket，被前端签名路径/同源约束安全拒绝；actualReferenceDownloadDelivery NOT_RUN。live 服务采用terminal origin，当前消费者限定BFF origin，目标部署拓扑兼容与可能的接口修正须在后续明确范围核验；未放宽为任意URL信任，也未用重写桥接响应宣称投递成功。此项是G1本机组合/目标联调的已知缺口。

真实IdP/MFA、目标BFF/数据库、Cookie/CORS、目标持久撤销、身份注册恢复码、原生通知投递、CSP/SRI/日志脱敏与Cookie属性、真实设备、人工读屏、原生200%、跨OS图像、远程同SHA CI、性能/容量/长稳和RELEASE全部NOT_RUN。HTTP快照未开启实时设置/撤权推送，网络恢复与最早session/context到期需重验。API presence只代表存在，不代替连接/授权或硬件验证。最多5页/500条是本次读取上限，不声称完整下载总量。

初次preflight-01的两次types执行复用了日志路径，首次原字节被覆盖；现存第二次原失败、工具输出摘要与[记录边界](./preflight-01/recording-note.md)明确保留，不冒称全量原始日志完整。其余后续失败/超时、原基线和冻结候选证据独立留存；最终门禁不复用任何预检PASS。

## 唯一确认范围

仅 FE:UI-P17 / I1、上述工程SHA/摘要/报告与完整稿的当前功能实现。确认若到达，应原样保存本会话答复并验证文稿/范围摘要；不能把任何BLOCKED/NOT_RUN转为PASS，不能提升INTEGRATION/RELEASE、formalAccepted或runtimeAdmission。当前没有确认记录，approval=null，不推定用户已批准。本轮执行指令仅授权实施和本地提交。
