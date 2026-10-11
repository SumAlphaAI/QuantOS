# TP04 完整 Python 套件回执修复与前置复评

修复 TP04 将完整 Python 套件写死为 `1002 passed` 的校验。继续绑定完整目录命令、源输入、日志 SHA、退出码；要求最终纯通过摘要且至少 1002 项，允许套件增长与 warnings，拒绝失败、错误、跳过、筛选、异常尾部及缩小命令。本轮不扩大 R03_LOCAL 授权，不使用本地数据库，不修改生产或发布配置。

修复前红测已记录 exit 1：[失败日志](./evidence/tp04-python-readmission-20261012/red/tp04-summary.log)和[输入快照](./evidence/tp04-python-readmission-20261012/red/receipt.json)。修复后 TP04 42 项回执正负向测试 PASS：[冻结前日志](./evidence/tp04-python-readmission-20261012/tp04-negatives-prefreeze.log)。

旧 TP03、TP04 组件 receipt/log/wheel/matrix 已在覆盖前完整归档，并绑定逐文件 SHA：[历史清单](./evidence/tp04-python-readmission-20261012/historical-files.json)。R04 预检、旧 R03 manifest、原数据库只读及 fixture 退役失败/收尾证据保留。

当前准备从新的干净提交执行 TP03、TP04、F0 必要闭包复评；实际结果将单独记录。因 Runtime/Engine/scripts 输入绑定发生变化，R03 原 READY 已撤为 NOT_ASSESSED，不能继承原结果。工程证据、目标数据库结果、正式验收及发布范围分开维护；`formalAccepted=false`。
