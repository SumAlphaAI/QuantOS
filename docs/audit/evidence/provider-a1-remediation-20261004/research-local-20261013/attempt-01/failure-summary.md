# BFF005 首轮全闭包诊断

冻结源码：0614ae649f4183e5359c686638d652f902735c03。139 组实际执行，126 PASS / 13 FAIL；未发布 READY；历史 canonical 产物已恢复。没有数据库、外部环境或发布执行，formalAccepted=false。

失败组：pre01-negative, pre04-negative, pre06, pre06-negative, schema, sabotage, plans, chromium, a1, a1-negative, a2-local-positive, a2-local-negatives, tp01-c-skeleton。

根因：PRE01 旧版本替换未实际触发；PRE04 旧字段数；PRE06 旧版本/operation/schema 库存及其 schema/sabotage/browser 下游；A1 未解析引用请求 schema 及其负例；A2 当前库存未同步导致正向证明拒绝刷新和负向入口失败；RELEASE handoff 机器清单未同步，连带计划和 TP01-C 骨架拒绝。修正后须冻结新源码并完整重跑，不能拼接本轮 PASS。
