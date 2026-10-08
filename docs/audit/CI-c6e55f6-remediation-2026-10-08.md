# c6e55f6 远程 CI 剩余错误整改

日期：2026-10-08。失败完整SHA：`c6e55f67dede46e4d47eec0b7dcfc70bf0f15ab6`。依据[QuantOS CI运行](https://github.com/SumAlphaAI/QuantOS/actions/runs/37757791605)、[原始失败日志](./evidence/ci-fix-c6e55f6-20261008/quantos-ci-failed.log)与[作业详情](./evidence/ci-fix-c6e55f6-20261008/remote-jobs.json)。

## 1. 根因与影响

本SHA触发8个工作流，7成功、1失败。上一轮修复已获远程验证：Frontend Baseline成功；QuantOS CI内R02、F05、migration baseline、lint、workspace test及SCA均成功。

剩余根因是`make f02-db-check`依次在同一PostgreSQL集群重建目标库与参考库，R02历史迁移无条件执行`create role quantos_snapshot_writer nologin`。角色为集群对象，第一库执行后第二库报`role "quantos_snapshot_writer" already exists`。签名/下载作业因此未执行，verify-download的失败是上游失败的连带结果，不能把skipped计为验收成功。

继续检查回放路径还发现同库事务回放只替换`quantos` schema，未替换R02新增`quantos_snapshot_api`，角色问题修复后仍会碰到现有API schema重名。

## 2. 修复

- 新增受控migration SQL适配器。只对文件名及SHA-256完全匹配的历史R02迁移，将唯一角色声明改为不存在时创建、存在时验证不可登录且无superuser/createdb/createrole/replication/bypassrls属性。不兼容角色直接拒绝，不删除、替换、降权或吞掉数据库错误。
- apply和事务replay共同使用适配器；raw SQL文件与ledger校验和不变，其余SQL逐字保留。历史校验和为`b58d2bef2dd9c9d313adc0f0a913a3ffffe3d75bef64c24bab8a99b797527406`，不修改已应用迁移或重算目标ledger。
- 事务回放同时映射数据schema和API schema，保留共享角色身份；严格限制生成的replay schema格式，保留外层rollback与原重建、checksum、schema drift、RLS和权限拒绝矩阵。
- `db-migration-check`增加适配器回归；F02真实数据库Gate增加角色重复初始化、危险LOGIN拒绝及事务fixture清理测试，失败仍使Gate失败。工作流与签名/下载要求未改变。

## 3. 验证与证据

静态检查与目标执行分别记账，详情见[验证台账](./evidence/ci-fix-c6e55f6-20261008/validation-results.json)：

- migration适配/UUID边界8项单元测试PASS；涵盖精确原始checksum、非登记迁移不改写、历史SQL篡改拒绝、两schema映射、事务边界及schema注入拒绝。
- `make db-migration-check` PASS：6项适配器测试、迁移命名与55张表RLS静态检查通过。静态结果不计数据库验收。
- 已配置Supabase实际角色测试PASS：原角色连续两次初始化、新具名NOLOGIN角色连续两次初始化、改为LOGIN后42501拒绝；rollback后确认fixture角色不存在，原ledger checksum不变。仅事务内角色fixture，无新增数据库、schema或本机服务。
- `make f02-check` PASS：23项安全/迁移/RLS/schema drift/回执拒绝回归通过，1项bucket真实数据库测试SKIP，未计数据库PASS。首次未指定本机Gitleaks路径导致的2项失败保留，使用工程现有固定版本扫描器后复跑通过。
- 联合计划检查与38项负向PASS，组件disposition的22项回归PASS，F0记录仍NOT_ASSESSED/admitted=false；R02 source/stage检查PASS。未执行本机或新Supabase隔离环境的完整双库重建/整库回放。

原失败日志、8个同SHA远程结果、目标执行输出与当前验证均单独存放。此前634份开发准入原件及上一轮CI证据不改写。

## 4. 当前状态与后续

本轮完成定位、代码修复与聚焦验证。当前159节点仍NOT_ASSESSED，不借本轮局部测试恢复14份旧阶段回执；功能完成状态与历史结果保留。发布Gate、正式用户确认、provider用途及B01/FA-H01边界不扩展。

修复提交尚需推送后，在Ubuntu实际CI完成双库重建、事务回放、后续F05数据库Gate与签名/下载检查。本地聚焦PASS及Supabase角色测试不等于该完整流程或新提交远程CI已通过。
