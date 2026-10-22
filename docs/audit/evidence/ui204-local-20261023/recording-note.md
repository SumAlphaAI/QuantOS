# 记录范围

最终执行入口 `node scripts/ui204-review.mjs --run docs/audit/evidence/ui204-local-20261023/attempt-02` 在工程54ab042b执行完成；每条实际命令、起止时间、退出码、日志摘要及产物均由脚本写入attempt-02。最终门禁回执仅使用此目录，不拼接attempt-01或preflight通过。

初版a7706db4记录停止在browser退出1；原始执行日志保留，门禁没有为其写PASS回执。预检查使用未冻结工作区时，浏览器来源明确标PREFLIGHT_WORKTREE_NOT_CANDIDATE。单例诊断偶然通过不能覆盖前次失败；分页测试根因与修正见preflight-notes。

八份失败Playwright error-context含生成源码摘录的行末空白，.gitattributes只对这八个精确文件设-whitespace以保持原始字节，其余代码/文档空白检查继续适用。所有日志/附件在清单按真实字节散列。

不运行目标数据库、真实IdP、生产凭据、推送或部署，不将局部通过提升为G1/FEP-1联调或发布验收。完整确认稿等待项目用户，Codex没有自行批准。
