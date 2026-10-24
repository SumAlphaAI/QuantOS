# 非冻结预检诊断

所有预检运行在未提交工作树，GITHUB_SHA=5372b8cc只标识启动环境，不是这些变更已绑定该SHA。

- before-fix.log：6探针5失败1通过；K线探针漏有效envelope字段导致假阳性。
- corrected-probes-before-fix.log：补齐envelope后6探针全部失败，证实残帧/UTF8、时间和许可边界缺陷。
- after-fix.log：修正后三个文件的78项直接测试通过。
- optional-c09-before-fix.log：真实Shadow/C09局部403对应新增探针失败，另有401/撤权探针通过。
- optional-c09-after-fix.log：新探针通过，旧UI402“所有C09 403清空行情”预期失败。按新的C01显式再核查局部拒绝语义更新旧预期，补充真实撤权/401负向；不扩大服务权限。
- browser：2通过4失败。首次使用原静态构建，揭示实际Shadow C09 403导致C12清屏；另外C15列表测试缺accountId。
- preflight-02：重建当前应用后4通过2失败。Audit链接的箭头导致exact名称定位错误；C09缺口探针缺accountId触发422。均为测试工具问题。
- preflight-03：修正后六项组合浏览器通过。C15重跑为确定性同源，账本hash未变；不声称新增财务事实。
- 工具初检：G4负向nextTask误用了实际期望FE:FEP-4导致1失败；planCheck历史文本传入次序应core→frontend，颠倒触发PRE-01 missing acceptance_window。修正为不同非法nextTask和正确文档次序。原诊断来自工具返回摘录，非完整raw log。
- 计划检查先于本证据README创建，曾因链接不存在拒绝；补齐实际范围说明后继续，不生成虚假receipt。
