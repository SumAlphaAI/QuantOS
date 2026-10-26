# CORE:X06 当前功能验收文稿（待 ProjectUser 确认）

节点：CORE:X06；范围：2026-10-26 当前执行/审计/运维 Web 功能及直接相关回归。源码版本、输入与命令以同目录 receipt.json 为准。本稿尚未收到用户对本候选的验收答复，formalAccepted=false；任务执行授权及本地提交不作为 ACCEPTED。

拟确认的工程范围：固定 Audit 会话权限及最短租约，MFA 前重读 C01；权限丢失清除未知导出意图，临时故障保留原键显式恢复；同一个自有 Rust reference Paper BFF 的 P08–P14 导航、独立 Approver 审批/MFA、Operator Command/撤单丢失响应恢复、完整 C10 链及原始水印导出；C11 InspectHealth 和 P14 目录读取。选取直接相关原生/consumer/浏览器拒绝与恢复验证，保留失败记录。

拟保留的边界：工程 PASS 仅针对 receipt 当前范围；完整业务联调 PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、runtimeAdmission DENIED。reference 身份与 MFA/TLS/CORS、内存存储是测试替代，Paper mock 没有真实成交。C09/C11 公共来源、InspectEvidence/incident resolve HTTP 正向、P13 七服务/全量遥测、P14 全部治理元数据及实时闭环仍有缺口。真实身份/数据库/持久化恢复、完整浏览器/人工无障碍、原性能目标、目标环境、远程 CI、发布均 NOT_RUN。

确认本稿最多接受该冻结版本的当前工程功能，不授予交易业务职责、Assisted Live/生产凭据、外部 venue、推送、部署或发布权限，不关闭完整 X06/X3 Gate。下一可执行原项为 CORE-GATE:X3 的 DEVELOPMENT 当前评估。
