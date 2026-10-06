# 复现边界

- sourceCommit=ce4907cd819cdca30cba2a59f66cc51dc30fffda；只读源码与内存 reference provider，不连接数据库。
- baseline-results.json 记录每条原始命令、时间、退出码；仓库自有源码与锁文件未修改。
- runtime-probes.rs 是独立二进制，依赖当前 bff-gateway。复制 probe-Cargo.toml/probe-Cargo.lock 至仓库外工作目录，把 bff-gateway path 换成当前仓库 services/bff-gateway；将 runtime-probes.rs 作为 src/main.rs，再执行 cargo run --locked --offline。lock 已增加外部 harness 自身条目，所有其他 dependency name/version/source/checksum 均与源码锁一致。
- gateway-probe.test.ts 和 probe-vitest.config.mjs 在仓库外执行。原件使用本机绝对路径；换 checkout 时只调整导入/输出路径与 include，运行 pnpm --filter @sumalpha/terminal exec vitest run --config <external-config>。
- gate-probes.mjs 直接调用现有 validator，对内存输入做破坏，不编辑业务源码。两个损坏样例仍 PASS 是漏检观察，不是整改通过。
- inventory-producer.mjs 保存六路由/三依赖的静态清单与关键输入 SHA；它不作为六 API 目标执行证据。
- nonbaseline-* 留存首次不同外部 lock 的结果，未作为 source-lock 结论；locked-before-manifest-update.log 与 auth-matrix-before-valid-headers.log 保存 harness 准备/不完整头重试。最终 runtime-probes.json 有 13 个成功观察断言项，2 healthy、11 缺口观察。
- 所有 reason/cookie/CSRF 等值均为仓库 fixture 或明确合成值；没有实际账户或业务数据。
