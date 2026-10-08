# R02 当前开发准入复评证据

冻结起点 e3fbdeca2d38299981e88ace277a74a01fca1baa。必要闭包14节点/57命令组；原5547211回执是历史证据，不能放行当前输入。

- attempt-01：已完成6组，5 PASS/1 FAIL；F06 Execution报连接意外中断，原日志缺阶段，保留UNKNOWN。F09目标已通过。静态unit测试阶段主动停止，控制器143，剩余51组未完成，无READY发布。
- 原始日志、失败F06七命令序列与执行台账保留；两项实际收尾检查PASS（Engine scope无残留；只读Supabase F06 fixture actor/session/secret_ref均0），不把FAIL改判PASS。
- repair-prechecks：修改后的开发预检，F06连接/负向33项与严格receipt46项全部通过；不是冻结源码同SHA目标准入。
- 下一轮必须冻结修复源码、使用空新目录完整执行57组；全部通过并严格校验后才更新当前准入。

范围：现有Supabase及具名fixture，不建立本地/隔离数据库；无新provider摄取，保留1800秒BTCUSDT/ETHUSDT内部研究原批准，旧行情Degraded；C25/C26部署/性能、远程候选CI、正式人工确认仍分开。旧数据库事实与失败证据不删除/重建。
