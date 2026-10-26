# CORE-GATE:R1 当前研究闭环评估

2026-10-26，依据主计划第9节、AGENTS.md和分阶段测试策略。本轮评估当前自有本机研究组合并修复发现的功能缺陷，不执行历史27/40节点闭包、递归依赖验收、全仓测试、F05/F07 campaign或外部目标操作。当前入口：

```sh
node scripts/core-r1-review.mjs --run docs/audit/evidence/core-r1-local-20261026/attempt-N
node scripts/core-r1-review.mjs --verify
node --test scripts/core-r1-review.test.mjs
```

`pnpm check:r1-local`、`make r1-local-check`指向当前评估验证器；旧R1_LOCAL保留为`pnpm check:r1-local:historical`，旧跨消费者research-local入口仍仅作历史检查。执行器只继承PATH/HOME/TMPDIR/语言及公开示例环境，离线启动本机UDS与loopback端口，不加载私有dotenv、不传入数据库或生产凭据。所有attempt必须全新目录；日志、源码/二进制/输入/产物hash保留，失败不拼接成PASS。

## 当前修复与实际模块

- R04允许确切的`research.vibe_adapter.execute`来源，沿用R03 run、tenant/workspace/actor、session能力、snapshot/policy、Evidence成员及canonical hash/size校验。伪造能力、跨身份、变更Artifact、过期引用和注入context仍拒绝。
- R04每个进度checkpoint保留原始请求；同键调度返回已有run时保留已有checkpoint，不把signal_ready或completed覆盖回初始状态。恢复仍通过既有Manager幂等和repository upsert，Signal/Proposal各一份。
- Manager将protobuf map转换为有序JSON Value后计算请求指纹，并绑定workspace，消除嵌套map重建造成的非确定冲突以及同tenant/key跨workspace复用。等价输入重建16次命中原结果，变更workspace或内容拒绝。
- R04请求issued_at使用不可变run.created_at，替换输入hash选择任意日历日期。provided及engine Signal在队列/消费时检查generated_at≤observed_at<valid_until；边界测试覆盖未来和到期拒绝。Proposal保持不可执行及已有评估有效期拒绝。

浏览器提交真实P03意图，由cfg(test)宿主显式映射到实际R03/RD-Agent或Vibe worker，再以受信入口调度原生R04→EngineManager→LLMQuant/TradingAgents Python UDS进程。R04使用已授权内存快照，不注册OpenBB/data-query路由；OpenBB的用途许可没有由本测试取得。Research结果由P04/C04读取，native Signal/Proposal主记录和snapshot元数据摘要以及附属Artifact manifest摘要追加到reference C10 Audit，页面检查因果链。canonical字节另存证据，保留Rust浮点`1.0`表示；浏览器核对原字节摘要且解析结果等于实际记录，避免JavaScript重编码的数字差异。

23个R1浏览器场景覆盖20个固定Vibe workflow、RD正常路径、RD及Vibe各一次Signal完成后缺失Proposal路由的恢复。每场景实际执行22类来源拒绝、同键调度/完成后重放、零重复事实和无订单副作用检查；再回归共享宿主/fixture受影响的5个U01场景。恢复是**同进程克隆内存Runtime/repository并重建coordinator/补路由**，Manager保持原实例；不能称为持久化重启恢复。

## 必要回归与证据绑定

Manager指纹是共享执行路径，定向回归其unit/negative、嵌套map幂等、RD/LLMQuant/TradingAgents/Vibe以及StrategyLab，覆盖直接受影响消费者；不递归重验其上游Gate。Runtime回归Signal/Proposal contract/单元、R03→R04来源校验和Research取消/完成（隔离Vibe导入）；Python回归原生研究三引擎contract/开发测试及adapter contract、100安全负向、20固定workflow、移除后其他engine启动和新ResearchArtifact投影。执行器检查无失败/跳过、门禁负向、计划、Rust格式和定向TS/Node lint。

Web产品输入未变化，复用U01源码`4d5362e1cca41a72f826c80e3c7f41f9c430f56d`的静态导出；核对原buildId、产品输入差异和所有182个导出文件hash。本轮不声称重新构建Web。新Runtime/Manager/宿主按当前冻结候选编译与执行；历史R04矩阵是不可变schema测试输入，也进入本轮源码清单，不能视作目标验收。

## Gate与未决风险

完成当前开发评估后工程Gate为`PASS_OWNED_LOCAL_R1_RESEARCH_LOOP`，完整R1为`PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN`。正式checkpoint保持review_status=NOT_STARTED、source_commit=null，stage_gate=INTEGRATION/NOT_ASSESSED；formalAccepted=false、runtimeAdmission=DENIED，原四项完整验收清单保持未勾选，不自签ACCEPTED或改绑历史READY。原始结果见[证据目录](../audit/evidence/core-r1-local-20261026/)。

仍需在原任务范围补齐：生产BFF研究到R04路由、实际身份/Cookie/CORS、持久C03/C04/Audit、Signal/Proposal目录和附属Artifact实际内容投递、跨进程重启及完整取消/deadline组合、全浏览器/人工可访问性和完整业务联调。当前C10是测试宿主追加的原生记录摘要，附属Artifact只有manifest承诺，不等于其内容已进Storage。旧Manager持久指纹格式不兼容新workspace/有序输入指纹，旧progress-only checkpoint缺失请求也不能自动恢复；保留fail-closed，不删除原审计或自动迁移/放宽校验。实际目标ledger迁移及历史任务恢复尚NOT_RUN。

Supabase目标、用途许可/外部数据、fork远端治理、性能/长稳、目标部署/回滚、同SHA远程CI及发布均NOT_RUN；未使用生产凭据，无push或外部发布。下一可执行原任务为`CORE:S04`的DEVELOPMENT；完整R1的INTEGRATION入口继续拒绝，不阻塞无关功能开发。
