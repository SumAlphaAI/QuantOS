# R02 当前开发准入复评证据

冻结起点 e3fbdeca2d38299981e88ace277a74a01fca1baa。必要闭包14节点/57命令组；原5547211回执是历史证据，不能放行当前输入。

- attempt-01：已完成6组，5 PASS/1 FAIL；F06 Execution报连接意外中断，原日志缺阶段，保留UNKNOWN。F09目标已通过。静态unit测试阶段主动停止，控制器143，剩余51组未完成，无READY发布。
- 原始日志、失败F06七命令序列与执行台账保留；两项实际收尾检查PASS（Engine scope无残留；只读Supabase F06 fixture actor/session/secret_ref均0），不把FAIL改判PASS。
- repair-prechecks：修改后的开发预检，F06连接/负向33项与严格receipt46项全部通过；不是冻结源码同SHA目标准入。
- 下一轮必须冻结修复源码、使用空新目录完整执行57组；全部通过并严格校验后才更新当前准入。

范围：现有Supabase及具名fixture，不建立本地/隔离数据库；无新provider摄取，保留1800秒BTCUSDT/ETHUSDT内部研究原批准，旧行情Degraded；C25/C26部署/性能、远程候选CI、正式人工确认仍分开。旧数据库事实与失败证据不删除/重建。

## 第二轮与连接生命周期修复

attempt-02/79ea170完整57组：55 PASS、2 FAIL（F02未捕获ECONNRESET且留旧PASS文件；R02 chain首次建连超时）。未发布READY，原始日志/旧文件归属/失败嵌套对象保留。实际只读catalog和迁移账本匹配最后成功基线，探针列/索引不存在；最终Engine scope84aa77c4无残留。

修复F02运行前撤销旧PASS、逐阶段连接事件/SQL失败诊断、独立只读收尾，v2回执严格绑定bootstrap/certificate/cleanup/7断言；SQL后不重连、不重放。R02准备连接在Cargo前关闭，独立具名actor收尾连接，两者首次连接最多3次，Node操作者单独验证CA，Rust沿用原连接契约。

connection-repair-precheck只算未冻结开发预检：真实F02与chain-02 PASS、actor inactive、两连接关闭。chain第一次因临时启动器使用Rust不支持的SSL值FAIL、收尾PASS，原件保留。29连接/10F02生命周期/82严格回执回归与33项F02负向通过（1数据库条件项NOT_RUN）；不能把预检重标为新提交同SHA准入。下一轮须冻结新源码、空attempt-03完整57组。

提交前再次检查修正未关闭连接分支的未定义变量，新增关闭失败负向；最后静态回归30项连接与34项F02负向PASS（1条件数据库项NOT_RUN），见 final-close-regression。前述实际数据库预检及当时源码哈希原样保留。
