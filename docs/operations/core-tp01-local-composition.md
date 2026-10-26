# CORE:TP01 当前功能与本机研究组合

依据主计划第9节CORE:TP01、AGENTS.md和分阶段测试规程。本总项消费SERVICE:TP01的原范围参考，在U01后补实际研究消费路径。当前默认入口是 `node scripts/core-tp01-review.mjs --run docs/audit/evidence/core-tp01-local-20261026/attempt-N`，复核为 `--verify`。不调度旧31节点闭包、三轮构建、F05/F07 campaign或远程同步。

## 实现

1. `vibe_adapter.research_artifact`把已校验的QuantOS workflow和audit投影为ResearchArtifact，保留fixture、原生身份、snapshot/policy和三阶段stream。明确trade_executable=false、tools_executed=false、snapshot_bytes_resolved=false。与原先独立workflow文档相比，R03现在可校验并归档实际输出，返回可消费的Artifact/Evidence。
2. R03原生研究入口加入确切的`research.vibe_adapter.execute`，仍经Runtime session/tool能力校验、批准的Engine manifest、快照质量、预算/deadline、输出身份/hash/成员及事件校验。不授予订单、secret、shell或网络工具权限；只有hypothesis权限的session不能调度此能力。
3. 扩展cfg(test)自有组合宿主：reference C03意图→实际R03 scheduler/worker→EngineManager→vibe-adapter UDS Python进程→R03 canonical Artifact repository→C04查询、通知和Audit→真实P03/P04页面。节点不是代理合成终态；测试读取实际record并核对Artifact/Evidence及hash。
4. Web测试仍使用现有公开`research.hypothesis.v1`表单意图，由受信测试宿主选择固定Vibe fixture并映射到内部能力。该映射、BFF→worker run ID映射、reference身份cookie桥、自签TLS/CORS和内存C03/C04都是显式端口替代。公开BFF/OpenAPI未新增Vibe能力选择或生产路由，不能将测试宿主称为已部署Vibe工作流。

## 受控吸收、工具、MCP与记忆

`UPSTREAM.md`、v0.1.13锁定SHA、LICENSE/NOTICE/SBOM、只读副本与受控fork配置、两项patch queue/decision、同步/回滚规程继续有效。本轮仅使用QuantOS内已有固定源，不拉取上游、不写fork、不调用GitHub或发布。intake检查验证锁定字节和只读配置；fork回执为pending-auth。原CVE报告是历史结果，本轮只验证模拟CVE分级与阻断，不声称执行最新漏洞扫描。

吸收仍限workflow分解和streaming阶段投影。工具白名单是参考计划数据；不执行`read_url/web_search`或任意文档读取。MCP只借鉴边界和工具目录形状，不嵌入上游server或传入认证配置。记忆只允许未来经QuantOS授权Artifact引用承载；本轮不新增记忆写入/召回，不读取`~/.vibe-trading`，上游session/状态/secret/venue不进入QuantOS。engine自有Artifact facade依旧是有界内存mock，R03负责独立校验/归档；持久Artifact API/Storage没有执行。

## 当前矩阵与证据

| 路径 | 必要检查与原因 |
| --- | --- |
| 锁定来源/受控fork | 本地repository checker、许可证和原CVE证据hash、patch queue精确核对；不访问远端治理 |
| S0–S3 | 既有sync分类器离线执行API破坏、许可证变化、CVE、patch冲突、S2/S3、陈旧和畸形输入；保存新目录中的原件，模拟拒绝保留预期非零退出码 |
| Python adapter | contract、skeleton、absorption、rollout、replacement及新增20个R03 envelope测试；覆盖100安全负向、20固定输入双RPC回放、取消/deadline、禁用/回滚、模块替换、Artifact与错误边界 |
| Runtime/Manager | 当前research单元含Vibe确切授权；实际既有RD-Agent/R03运行与取消测试（阻止vibe导入），Manager的Vibe全RPC和拒绝测试；验证移除后仍启动 |
| Web消费 | 20个Vibe fixture实际经R03生成record并由页面读取Artifact/Evidence，外加排队取消；直接回归U01五场景，因共享宿主/启动器/测试fixture受影响 |
| 编译/静态/门禁 | bff lib编译、Python定向ruff/format、Node/TS定向lint、阶段负向、两计划结构；不默认全仓或上游递归重验 |

Web应用和packages运行时代码未变，复用U01候选4d5362e1的现有静态导出。执行器核对这些产品输入未变、原buildId及全部当前导出字节hash，记录原SHA，不把它改记成新候选构建。新的Rust/Python/测试/文档和执行器先提交冻结；证据以实际候选SHA、源输入、逐命令时间/退出/信号/日志hash及产物清单绑定。环境只从白名单构造，不读私有dotenv，不继承数据库/生产凭据，只启用本机UDS/loopback进程。

## 阶段状态与下一项

当前功能开发COMPLETED，工程Gate为`PASS_OWNED_LOCAL_TP01_RESEARCH_COMPOSITION`。本机20fixture成功不是TP01总项正式ACCEPTED：完整联调`PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN`，stage_gate保持INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。SERVICE:TP01、U01、FEP-2、G2/R1和旧确认不随本提交提升。

待补：正式BFF到Vibe路由/能力选择、持久C03队列/C04 Storage、跨进程恢复和完整取消/deadline业务链、真实IdP/Cookie/CORS、真实fork远程治理、完整浏览器/人工可访问性和全仓联调。目标Supabase、7天canary、目标回滚时效、真实监测/部署、性能/长稳、同SHA远程CI和发布均NOT_RUN。没有外部发布或生产授权。

下一可执行原项是CORE-GATE:R1的当前研究闭环评估；DEVELOPMENT入口允许，完整INTEGRATION在缺口关闭前仍拒绝。新发现只在原任务范围记账，不新增阻塞功能开发的辅助任务。
