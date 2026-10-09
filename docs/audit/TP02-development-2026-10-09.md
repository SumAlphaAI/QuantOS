# TP02 RD-Agent 自动研究/实验 Engine 开发验收

日期：2026-10-09。范围：R1 DEVELOPMENT；依据计划 TP02，结构化前置为 F08/F0。

## 当前结论

代码和组件工程检查通过，冻结源码后的必要依赖完整复评待执行。不得将组件通过称为当前 DEVELOPMENT READY。R1 是阶段标签，不以尚未关闭的 R1-SERVICE 整体 Gate 冒充 TP02 前置已完成。

## 实现与边界

现有 upstream intake 明确替换为 fixture-backed QuantOS native provider。未接入 Microsoft RD-Agent、真实 LLM/工具、交易或生产秘密；原 v0.5.0/SHA 与 productionApproved=false 不变。

| 控制 | 交付 |
|---|---|
| 五 RPC 与两个 capability | hypothesis/experiment 映射自有 ResearchArtifact，fixture 类型错误拒绝 |
| 固定输入回放 | 同一请求 Execute 两次及 StreamExecute 两次，input/output/hash/ref 一致；prompt、catalog 与审计身份绑定 |
| 权限与边界 | Research-only、匹配 capability、严格字段/类型/范围和递归 secret/trading/network/authority 拒绝，两个 RPC 相同处理 |
| Artifact | 实际不可变 JSON 字节、完整字节 SHA256、tenant/workspace/actor 读隔离、内容寻址 mock URI；无虚构 Supabase 上传 |
| 生命周期 | scoped Cancel、等待/流式 deadline 与 transport 检查，取消确认后无新 Artifact 写入，写入/取消共锁 |
| 幂等 | 同 owner/run/key 改输入、capability、snapshot/policy 或 trace/request 身份拒绝，原对象不变 |
| 打包运行 | 实际 SDK/RD-Agent wheels、干净venv、仅锁定运行时依赖字节、离线安装、-I 独立子进程五RPC、两capability/回放/拒绝、子进程回收 |
| 准入 | 工程检查与统一manifest分离，绑定实际命令/源文件/日志/wheel字节和递归依赖；负向探针拒绝伪证据 |

DataSnapshot refs 是固定输入标签；本 Engine 不读取任意数据或执行允许工具，显式输出 snapshot_bytes_resolved=false/tools_executed=false。可信引用/质量/用途授权在既有 Runtime/R02 边界处理，不能将 ref 标签称为真实上游研究或真实快照字节验收。Artifact 和审计是内存 facade/metadata；持久化和已部署授权链另验。

## 组件与原始失败

- `engines/.venv/bin/python -m pytest engines/tests/test_rd_agent_contract.py engines/tests/test_rd_agent_development.py -q`：131/131；新增126，包括84个双RPC输入拒绝、8个非Research模式、14个身份冲突、6个取消权限、3个对象隔离、6个运行中停止、2个流式delta间停止、2个回放及导入边界。
- 全Python：433/433；Rust Manager RD-Agent契约：2/2；类型/静态检查通过。
- 首次wheel验证缺少已锁定hatchling build组，补齐locked all-groups；第二次离线解析缺少registry索引缓存，改为仅复制已锁定grpcio/protobuf运行时发行包字节，再离线安装自有wheel。原失败完整保留，不声称联网安装或真实上游运行。
- 最终组件清单和完整依赖执行台账将在冻结后落档。前置旧16节点回执因功能输入变化撤销，原文件及历史用户确认保留；未迁移 hosted CI 或正式 ACCEPTED。

## 风险与下一任务

真实上游/模型/工具、OS出站隔离、持久Artifact/audit、部署身份链、代表性P95<1s与长稳尚未验收；当前研究provider为受控fixture替换。不得使用生产凭据或执行外部发布。下一可执行开发任务为TP03（F08/F05/F0前置须当前READY）；R03仍须R02自身当前准入。仅生成本地提交，不推送。
