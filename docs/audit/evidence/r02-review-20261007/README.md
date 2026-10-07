# R02 全面复审证据

日期：2026-10-07；源码基线 `6aa5b9ee5c42e1527fbad47cfec4e71282340db9`，审计开始时工作区 clean。结论见[报告](../../R02-comprehensive-review-2026-10-07.md)；[机器索引](./index.json)含检查点、问题及文件 SHA256。原日志、失败和 fixture 事实保留。

## 本地与目标分离

| 证据 | 方法、结果及适用范围 |
|---|---|
| [默认 Gate](./r02-check.log) | `make r02-check`，失败于 Runtime admin-role 单测；Makefile 自动加载 `.env.local`。不能称作完全本地隔离，也不据此新增 R02 算法问题 |
| [本地 Gate](./r02-local-only.log) | `QUANTOS_SKIP_ENV=1 make r02-check`，12 Node、13 storage、12 runtime、16 strategy 通过；DB 早返不计目标执行 |
| [边界探针](./boundary_probes.rs)、[日志](./boundary-probes.log) | 临时复制为 `crates/quantos-storage/tests/r02_audit_probes.rs`，`cargo test -p quantos-storage --locked --test r02_audit_probes -- --nocapture`，结束移除接线。9/9 断言通过，其中 8 个断言证明坏行为仍被接受/发生 panic，1 个为 expiry 相等边界观察；不是修复通过 |
| [fmt](./fmt.log)、[Clippy](./clippy.log) | `cargo fmt --all -- --check`；`cargo clippy -p quantos-storage -p quantos-strategy -p quantos-runtime --all-targets --locked -- -D warnings`，通过 |
| [本地 coverage](./coverage-local.json)、[采集日志](./coverage-local.log) | `cargo llvm-cov -p quantos-storage --lib --locked --json --summary-only`；snapshot 93.28% line / 92.54% region 含内嵌测试，PG 0%，Storage 41.40% / 37.04%；不代表目标或独立生产行覆盖。本轮未启用 nightly branch 测量 |
| [目标 SQL 脚本](./target-probe.cjs)、[结构结果](./target-probe.json)、[日志](./target-probe.log) | 通过 Node `--env-file=.env.local` 加载配置，显式 `QUANTOS_R01_POOL_MODE=transaction` 选择同项目事务池；6 项 5 PASS / 1 FAIL。SQLSTATE 42501 正向成员读失败；跨租户 schema、错误 hash/expiry、宽松 trading rule 均可写。所有 auth/member/tenant fixture 事务回滚，rollback 确认 PASS |
| [目标权限](./target-privileges.json) | 只读 `has_schema_privilege / has_table_privilege / has_function_privilege` 与 grants 查询；缺表权限诊断。成员模拟使用 SET LOCAL ROLE + auth.uid claims，未使用真实 HTTP Auth JWT |
| [计划检查](./development-plan-check.log) | `node scripts/with-pinned-toolchain.cjs make development-plan-check`，结构/阶段/联合依赖 PASS，38/38 负向通过；当前 159 个 stage_gate 均 NOT_ASSESSED，不证明 R02 功能准入 |

本轮目标连接均为已有 Supabase PostgreSQL；未安装/启动本地 DB、Docker 或 Supabase CLI。没有供应商行情调用、整库 reset、远程 CI 或生产发布。凭据从环境读取，没有存入证据。

## 原生适配器尝试与失败保留

三个 wrapper 都将 Rust 探针临时复制为 `crates/quantos-storage/tests/r02_audit_target.rs`，串行运行 `cargo test -p quantos-storage --locked --test r02_audit_target -- --nocapture --test-threads=1`，结束移除接线。fixture 使用专用 audit tenant、service actor，metadata 保留。脚本不是无副作用的静态检查；不应直接当作 CI 正常 fixture 或自动循环长跑入口。

| 尝试 | 证据 | 原结果与解释 |
|---|---|---|
| 01，同项目事务池 | [wrapper](./run-native-target.cjs)、[Rust](./target_storage_probe.rs)、[日志](./native-target.log)、[退出](./native-target-run.log) | 240s 超时，actor 创建前停下。独立 [readback](./native-timeout-readback.json) 保存空 audit tenant；不能声称 Storage 或快照原生测试通过 |
| 02，同项目事务池 | [wrapper](./run-native-target-attempt02.cjs)、[Rust](./target_storage_probe_attempt02.rs)、[日志](./native-target-attempt02.log)、[退出](./native-target-attempt02-run.log) | 120s 超时；基础 Storage 上传/登记/GET 已比对成功，补偿调用未完成断言。连接/命名语句影响尚未证明，不归因于查询性能 |
| 03，原配置连接 | [profile](./native-configured-profile.json)、[wrapper](./run-native-target-attempt03.cjs)、[日志](./native-target-attempt03-configured.log)、[退出](./native-target-attempt03-run.log) | 保留 `.env.local` 的 session pool 5432，附加 connect_timeout=10，wrapper 120s 上限；31.88s 完成，exit 101、1 PASS / 1 FAIL。原生快照伪造 hash/expiry 持久化、冷读、Trading 放行断言成功；Storage 基础往返成功，失败登记之后 GET “必须 HTTP404”断言失败 |

第三次 Storage 的实际缺失响应是 HTTP400、JSON `statusCode=404` / `Object not found`，与探针写死的 HTTP404 不符。独立读回确认先前对象已被补偿 DELETE，manifest 留存。此为补偿所有权缺陷的证据，整次 Rust suite 仍保留 FAIL。没有改写原断言/日志来制造绿色结果。

真实 SQL P95 为 669.562625ms，25 次 round trip、事务内两条 fixture，无 Rust cache。nearest-rank 算法和全部样本在 target-probe.json；仅开发链诊断，正式性能由 RELEASE-GATE:BETA 验收，不是当前功能开发阻塞项。

## 收尾与事实保留

- [第一次收尾](./cleanup-native.cjs)、[日志](./native-cleanup.log)、[结果](./native-cleanup.json)：停用第二次留下的 actor，对该 owned object 独立 GET 成功比对后显式清理；不能把审计 DELETE 写成产品自动补偿成功。
- [最终收尾](./cleanup-native-final.cjs)、[日志](./native-cleanup-final.log)、[结果](./native-cleanup-final.json)：4 个专用 tenant、3/3 actor inactive；两个 owned object 均独立 GET 为 Object not found。第二个对象由第三次产品补偿删除，第一对象由审计清理删除。
- 保留一个负向快照、两个 manifest 及相关指标事实，不删除/重建既有 Supabase。停用 actor 仅限本轮精确 audit tenant 与 `service_name=r02-audit`。没有其他租户对象操作。
- [独立进程读回](./process-readback.json)确认本轮 audit 测试进程为 0，临时 Rust 接线已移除；仅本报告和证据新增。[最终复核](./validation.json)验证源码无改动、计数/链接/哈希和秘密扫描。

## 机器复核

`finalize-evidence.cjs` 从报告表格生成 controls/findings；每项问题保留模块、具体表现、影响及证据指向，严重度用于研发优先级。源码清单取基线 tracked files，文件清单排除 index.json 自身；二者各有 SHA256。

完整完成率按 PASS 计数、不把 PARTIAL 折成半分：11/28=39.29%。去掉纯发布性能 C25，功能/联调为 11/27=40.74%。这是检查点闭合比例，不是工时/代码行比例。缺失的当前目标覆盖、SDK/Buf 全套执行、生产 Trading 集成、部署/远程同 SHA CI 和正式签署均不补写 PASS。
