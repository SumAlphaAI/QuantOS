# 初次确认门禁探测

`node scripts/ui-p12-confirmed-reference.mjs --write` 首次退出 1：计划新链接指向本轮 README，当时该文件尚未落盘。输出重定向 `gate-initial.log` 为空，错误来自 stderr：

```text
AssertionError [ERR_ASSERTION]: docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md: broken local link ./audit/evidence/ui-p12-confirmation-20261023/README.md
    at validatePlans (scripts/check-development-plans.mjs:186:7)
    at nodesFromPlans (scripts/provider-a1-receipts.mjs:41:14)
    at verify (scripts/ui-p12-confirmed-reference.mjs:54:176)
```

上述为实际终端输出的路径简化转录，不宣称原始 stderr 文件。创建本轮 README 后继续确认检查，不重跑原功能链，不改原候选或原稿。
