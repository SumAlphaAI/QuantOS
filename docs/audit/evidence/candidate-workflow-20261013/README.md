# 本地验收基础设施修复证据

results.json 保存实际命令/退出码/日志摘要；inputs.json 绑定本次交付字节，不宣称基线 Git HEAD 的业务或正式验收已重授。GitHub、真实目标、签名和部署未执行。

initial-missing-a1-import.log：新增快照测试发现导入遗漏，已修复；CLI 负例加强为要求准确缺候选错误并拒绝 ReferenceError/TypeError。initial-secret-reference-probe.log：静态探针初误把 check-secrets.sh 文件名当凭据表达式；修正为匹配真实 secrets 表达式后继续扫描全部 main-push job。最终所有定向/门禁/用户确认/计划负例重跑通过。原始失败保留，不拼接旧 PASS。
