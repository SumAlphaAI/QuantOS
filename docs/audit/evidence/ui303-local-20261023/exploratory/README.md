# 未冻结预检，非候选验收

预检checkout HEAD为9229702d，应用与测试在工作区修改；日志和reference运行的GITHUB_SHA仅标识当时checkout，不能当作已提交应用源码通过。后续最终attempt使用独立冻结提交与重新构建。

- types01退出2、lint01退出1：审批POST参数少一个闭合括号、UI选择拒绝catch空块。修正后types02/types03与lint02/lint03/lint04通过。
- unit01：67通过；unit02：123通过；添加真实DTO溯源回归并扩展生成consumer后unit-consumer01：125通过。
- c05-01：21通过；binary01、terminal-build01/02通过，均是未冻结预检。
- browser01：6通过、5失败。实际Artifact比较拒绝创建：报告Zod解析丢弃draft的tenant/workspace溯源字段，实际Artifact保留该字段。provider-diagnostic.json保存真实reference DTO诊断。修复为保留scope字段，并补真假scope回归与实际consumer，不放宽证据一致性门禁。
- browser02：11通过，覆盖真实创建、申请、另一reference actor的MFA/reauth审批、目标显示、未知结果原键重试、旧head拒绝、只读与离线恢复、空/404。此预检不是冻结候选PASS。

原始日志、失败截图、页面文字、网络摘要与产物保留；未执行项不记通过。所有写入是本机reference进程内fixture，独立审批测试控制不属于产品UI或生产身份验收，无数据库、部署、交易或外部发布。
