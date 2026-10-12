# 首轮完整功能验收：FAIL，不发布 READY

冻结源码：39ff40bd86083a04056458c49e7e2320ebbf5408。
134 组：124 PASS、10 FAIL。保留 execution-results.json、全部执行日志与已产出产物。失败检查：pre01、pre01-negative、pre04、pre04-negative、a1-negative、a2-local-negatives、a2-local-identity-mutations、r04-local-products、tp05-development、tp05-negatives。

发现旧 API 基线、缺少当前 A2 正向执行回执、旧 raw digest 格式、Node 摘要识别和固定三场景的问题。首轮 R04 四命令和 TP05 十三命令本身通过，但包装验证失败，不能发布 READY。修复后必须冻结新源码、从全新目录完整重跑，不能合并本轮 PASS 得出准入。

未使用生产凭据、未执行目标数据库或外部发布。嵌套可复现构建原未透传离线标志，故不声明首轮全程离线；新实现透传三项离线变量。首轮实际测量仅诊断，不属于发布性能验收。
