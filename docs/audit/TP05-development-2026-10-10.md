# TP05 OpenBB 数据/研究适配服务开发验收

日期：2026-10-10。R1 DEVELOPMENT；必要前置F05、F08、F0。

当前受控fixture adapter实现完成，工程测试与必要依赖准入复评中，不能引用历史READY替代本轮检查。formalAccepted=false。本轮不加载OpenBB upstream，不取得法律/生产/外部数据用途许可，不使用生产凭据或执行外部发布。

实现、初始失败与修复、完整测试命令、当前源码及依赖闭包、未决风险、变更文件和下一任务将在冻结源码的实际检查完成后填入。

## 已完成工程范围

QuantOS自有mock与OpenBB-evaluation标签的五RPC fixture provider，versioned Data Contract/record JSON Schema，100实际UDS双Execute/双Stream重放，完整Artifact字节哈希与scoped读隔离。缓存绑定tenant/workspace/actor/workflow及完整input/metadata、fixture和license-policy；128项TTL LRU，读副本与并发隔离。取消/期限/执行身份及不可变双Artifact原子提交已验证。只允许Research及local/test环境；交易、生产/staging、未批准工具和递归authority/order/secret/network字段拒绝且固定机器码与scope hash审计。

生产构建实际拒绝包含OpenBB或当前评估adapter，在sync/build前终止；生产manifest亦调用排除Gate。开发wheel独立-I进程五RPC、取消<2秒、生产拒绝、无upstream package通过。许可证policy已与既有tag4.4.5/commit34de2f61427f2879df4ebbf5906ca0508c6e84f3对齐；没有取得AGPL/商业或实际数据用途许可。

预检12组组件通过：TP05 256、全Python1249、Manager2、100实际schema/4破坏、UI3项无skip、wheel、生产Gate8项、Ruff/11文件format/Pyright、locks/intake。全仓lint、计划负向38、P0策略16通过；必要13节点/53组实际复评待冻结后执行。历史TP03/TP04 Gate已撤销，不转授当前源码。

## 初始失败与修复

首次UDS输出测试100失败/150通过：Protobuf Struct将整数TTL读成double，原response_hash不能通过实际wire往返；canonical hash增加整值数字归一化后全部通过，[原始失败](./evidence/tp05-20261010/initial/response-hash-wire-number.log)保留。组件记录器初始selector/import路径配置错误及旧组件回执与新测试计数不符的负向失败保留于initial目录，未发布READY。

Rust集成1通过/1失败发现新生命周期漏掉evidence_refs；恢复两条实际Artifact引用并加入100样本映射断言，[原始失败](./evidence/tp05-20261010/initial/component-evidence-refs/manager.log)保留，当前Manager2/2通过。schema_hash由字段指纹改为实际随wheel分发的dataset record JSON Schema canonical字节hash；100样本独立Ajv校验通过。

## 未决风险和下一任务

真实OpenBB runtime、resolved依赖/CVE、法律结论与实际provider数据权限待验；两种标签当前都是QuantOS synthetic fixtures，无外部数据查询、工具执行、已认证source bytes或live freshness结论。持久Artifact/audit、部署HTTP/BFF/browser链、OS出站隔离、代表性负载/P95/长稳与生产取消时限未验。F05/F07历史性能风险不因本轮正确性消失，本轮实际指标待依赖复评填入。formalAccepted=false，未推送/hosted CI/生产凭据/发布。

下一可执行任务候选：TP08 Qlib限定范围评估（F05/F0），须先由本轮依赖准入结果决定。R03仍需R02/TP02自身当前准入。
