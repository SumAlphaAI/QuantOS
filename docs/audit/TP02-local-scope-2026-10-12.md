# TP02_LOCAL 本地准入范围（拟定，2026-10-12）

当前为PROPOSED_NOT_REGISTERED；本轮仅接口/fixture/安装wheel及必要前置预检，不授予TP02或R1-SERVICE READY。机器范围见[scope.json](./evidence/tp02-preflight-20261012/scope.json)。

唯一消费者CORE:TP02，直接依赖CORE:F08、CORE-GATE:F0。必要闭包固定为F01、F03、F04、F05、F06、F07、F08、F02、F09、TP01-A、TP01-B、F0、TP02，共13节点（依赖后序）；当前映射44组唯一本地检查。未来实现须新增TP02_LOCAL专用负向检查并重算数量，从新干净冻结提交完整执行，不能拼接当前D或旧R03消费者回执。

本地功能为QuantOS自有fixture-backed provider，非Microsoft RD-Agent运行时：hypothesis/experiment两个capability；两组固定fixture各Execute两次、StreamExecute两次，输出/input hash/Artifact引用稳定，五RPC、研究模式、身份/幂等/权限拒绝、Artifact租户/owner/hash隔离及取消/deadline均保留。DataSnapshot标签不代表真实字节读取，snapshot_bytes_resolved=false、tools_executed=false；无新采集、真实来源许可、交易或已退役32条事实消费。

安装wheel必须实际构建SDK/RD-Agent两份wheel，验证嵌入catalog与源码摘要，固定grpcio/protobuf锁定运行时，离线安装到干净venv，Python -I从site-packages导入并启动实际UDS子进程；五RPC/两capability/回放/拒绝须通过且子进程回收。editable安装、仅import源码或虚构五RPC记录不能替代。

12组目标/远程检查保留原命令并记NOT_RUN：F05数据库/容量、Storage数据库/目标、RLS、F06目标、F07恢复/覆盖/服务、F02数据库、F09目标、TP01-A远程治理。Supabase容量/默认可写、PostgreSQL迁移/RLS/事务/Auth/Storage、持久Artifact/audit/恢复、实际部署JWT/provider/LLM/tool、OS egress、P95接收<1s/代表性负载/容量/长稳/平台矩阵、真实数据用途、同SHA hosted CI及ProjectUser确认由测试/RELEASE-GATE:BETA实际验收。本地deadline语义仍须测，不以移交性能删除取消/超时边界。

预检使用独立audit目录，逐项执行原组件命令，保留原始日志、安装wheel字节及新工程回执；不覆写canonical、不改规范源码/计划或当前阶段Gate。既有TP01-D_LOCAL仅复核当前有效范围，不冒充新候选完整闭包。冻结输入/规范/所有阶段/历史失败必须前后逐字节一致；无新数据库、本机容器、生产凭据、订阅升级或外部发布。formalAccepted=false。

下一阶段须实现TP02_LOCAL单消费者注册、索引/wrapper、同候选/缺闭包/缺日志/换wheel/异常执行/发布回滚/正式越权拒绝，再从新冻结提交完整复验13节点；当前预检不得直接放行R1-SERVICE。
