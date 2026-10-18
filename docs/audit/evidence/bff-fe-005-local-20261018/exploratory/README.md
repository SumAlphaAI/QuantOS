# 工作树探索记录（不是冻结候选验收）

此目录的源码均为963fd053基础上的当时未提交工作树；HTTP脚本自动记录的HEAD字段只是基础commit，不表示当时工作树干净或该commit已经具备修复。最终验收只使用function-attempt的新冻结源码与inputs.json，不复用此目录PASS。

- pre-fix-market：只加入三个current_function回归后执行，三例均FAIL（future_receipt、空白approval、零条audit事实）。后续mutation在首个断言失败后尚未执行，未声称各项独立前置复现。
- pre-fix-consumer：新维度/provenance回归FAIL，其他5例PASS；unsafe JS整数原schema已拒绝。
- post-fix-market：实现修复后三例PASS，覆盖全部新mutation；types-consumers-01的TS错误属于新夹具NODE_ENV/unknown类型使用，types-02已修正通过。
- gate-tests-01：复制新scope时残留FE003 nodeId，43PASS/1FAIL；改为精确FE005后gate-tests-02全44PASS。原始日志保留。
- boundary-harness-failure：夹具误写ObjectVersion参数，现已改为契约IfMatch。
- http-01：夹具将EvidenceChain的correlationId错误放入query，FAIL；http-02正确path参数后50记录/七API/基本Chromium PASS。
- pre-fix编译耗时2m49s，读取进程与一次sample保留；样本只证明当时rustc等待工作线程，根因NOT_ESTABLISHED，不记作产品性能或容量证据。不修改OS保护或签名。
