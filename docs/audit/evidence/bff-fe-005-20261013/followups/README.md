# 首轮修正预检

checks.json 每项记录实际命令、时间、退出码与预期；在未提交修正候选执行，只作诊断，不发布 Gate。trade-recovery-red 仅回退盘口/成交最大序列逻辑，实际断言漏发新成交而失败（预期101）；逐字恢复后13项市场 Rust 测试全部通过。首次整文件回退造成编译缺失，保存在 initial-red-compile，不能用作回归证明。inventory 初次被前序失败掩盖的 operation 数量断言63未更新，原始失败保存在 initial-inventory-failure，修正70后重新通过。

PRE01 从 OpenAPI 动态读取版本；PRE04 459字段、PRE06 70operations/62schemas、A1引用 schema 严格校验、A2当前库存和实际正向证明、RELEASE机器清单均已复验通过。客户端/契约96、Gate55、实际HTTP33请求/7operation/Chromium均通过。数据库/外部/性能/正式验收 NOT_RUN。正式结果须以后续clean HEAD完整attempt为准。
