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

## 第三轮与 F06 fixture 收尾

attempt-03/80b70e5仅完成6组、5PASS/1FAIL，F06数据库步骤统一300秒截止，原日志只完成5测试、null退出且缺超时诊断，不能臆测第6测试内部阶段。F09目标PASS后在静态阶段停止，控制器143、owned子进程无残留，Engine scopecdd354ea独立检查PASS。核对单次执行窗口、随机tenant slug与合成auth user后，7fixture的14actor实际停用，账户和会话失效；事实保留。

后续修复：Rust在SQL前登记随机scope/fixture，保留事实停用替代忽略删除错误；父运行器独立核对身份与停用8fixture，严格回执要求全部actor/账户/会话为0、连接关闭。命令记录预算/耗时/信号/超时码；数据库整组功能预算900秒、HTTP步骤300秒不变，外层有界60分钟；不是发布性能阈值。124静态回归PASS；实际八测试与独立8fixture收尾PASS，只算未冻结开发预检（输入哈希保留）。首个临时启动器相对路径FAIL原件保留。下一轮冻结新源码，空attempt-04执行完整57组。

## 第四轮（失败）

attempt-04/c0c1fe9完成57组，52PASS/5FAIL，未发布READY。失败为F09外层30分钟截止并残留子进程、TP01只读git远程15秒超时、R01 SQL期间连接重置、R02静态Engine consumers15分钟截止与收尾发现3进程。F067步/8fixture、F02v2七断言/只读收尾和R02持久目标链均PASS；不能掩盖整轮FAIL。F09三个actor和遗留make/Cargo/Rust已精确收尾，事件数保留；R01四actor inactive，R02actor inactive，Engine发现3/remaining0仍保留FAIL。F09采样162条、窗口最后tick3及只读同查询约1.63s只是诊断，不臆测等待根因、不作新鲜度或性能PASS。

### 命令生命周期续修预检

当前未冻结源码：19 项生命周期/fixture/回执/只读重试负例与 82 项严格 Gate 回归通过；静态 Engine 五场景通过且无进程组残留；F09 Rust 仅编译与格式检查通过。未进行目标数据库验收，不能据此发布 READY。第四轮失败与未知 SQL/驱动卡点均保留；SQL 后业务操作不重放。
