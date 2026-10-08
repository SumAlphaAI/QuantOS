# 第四轮提前退出（保留失败）

冻结 c8aa8f8。F01 三次可复现构建 PASS；F06 无效 bearer 返回 HTTP 503，预期 401，FAIL；F09 实际 Supabase 目标 PASS 且目标自行完成后停止控制器（exit 143）。仅确认 3 项执行结果：2 PASS / 1 FAIL；完整 57 项未执行，不发布 READY。原始 HTTP trace 表明拒绝状态为 503，没有获得授权。

保存前三项原件、控制器输出、提前退出时间和本轮 scope 的进程检查。未启动 R01/R02 目标或真实 provider ingestion，未延长批准范围；失败不会被复跑结果覆盖。
