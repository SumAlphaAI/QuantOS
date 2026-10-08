# 第二轮提前退出（保留failure）

冻结55b4999：三次可复现构建PASS、F06只读preflight遇到Connection terminated unexpectedly而FAIL、当前F09实际Supabase目标完成PASS后停止控制器。仅确认3项执行结果（2 PASS/1 FAIL），完整57项未执行，不生成READY；early-stop.json/controller.log保留退出原因和时间，target原件与scope进程检查均保留，remaining=0。未启动R01/R02目标或真实provider ingestion，未修改原scope、事实或补写整轮通过。

后续修复只允许精确preflight连接终止错误重跑完整target，最多3次，permission/role等语义错误不得retry；失败原件保留。retry-fix-uncommitted-*只是未提交修复探针/单元回归，不替代新SHA空目录完整复评。
