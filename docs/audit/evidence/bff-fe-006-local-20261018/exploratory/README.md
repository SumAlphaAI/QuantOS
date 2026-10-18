# 冻结前诊断，不能作为当前候选 READY

本目录记录实际预冻结工作树诊断。HTTP 中 sourceCommit 仅为当时 observed HEAD，源码仍有未提交变化，不能绑定为该 Git commit 的功能证明。正式证据必须来自后续新 function-attempt，按完整输入 SHA 校验。

保留所有已生成文件，不覆盖失败日志/JSON。execution-tests-01 因自有 Proposal 内外 expiry 不一致失败10/10；-02 修复后9/10，剩余共享 CSRF 不识别独立审批人；-03原10项通过。后续增加 allow/deny/approval-required、真实Fill、Shadow、lease/proof及审批中断恢复测试；-05为14/15，测试复用了同一 command_key 后改变数量，真实风险器正确拒绝，改用独立场景键；-06为15/15；-07增加同一X01投影消费Fill后仍15/15。这些通过记录各自只代表当时工作树，不能复用为最终候选通过。

http-01 的 SSE 探针误按 JSON 解析，FAIL；http-04 在1023条时实际发现 Order.intent 暴露内核 limit，而页面契约要求业务 open/increase/reduce/close，FAIL，促成业务投影修复。boundary-01 是静态源码检查未容忍 rustfmt 换行，FAIL；后续诊断保留。clippy-01 发现两个可折叠 if，FAIL；clippy-02通过。原始失败日志和带failure/records的HTTP JSON均保留。

部分早期工具调用的原始输出只在会话工具记录内，未重建为完整日志：初次临时 YAML 编辑脚本在写文件前 BAD_INDENT 退出，原 OpenAPI 未被该失败调用改写；第一次 typecheck 报 consumer错误使用 EvidenceChain 节点不含的 redactionApplied；一次同进程更新 stageContract 后读取缓存旧 policy，计划注册中途退出，重启 Node 完成注册后 plans 通过。这些未落盘输出仅在 unfiled-tool-diagnostics.json 保存真实诊断摘录，不能当成完整 raw command log，更不能记作 PASS。
