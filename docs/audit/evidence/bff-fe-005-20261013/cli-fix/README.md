# 公开 CLI 循环导入修复

第四轮完整功能和原子发布 PASS，但公开 CLI 顶层 await 循环导致 exit 13。将纯证据校验拆为 bff-fe-005-evidence.mjs，CLI 静态导入 Gate，执行器只导入纯校验；新增真实子进程 CLI 模块完成及未准入拒绝检查。58 项通过；独立 CLI 未准入预期 exit 2 实际成立。第四轮 READY 撤回，新冻结提交须完整重跑全部 139 组并实际复验准入后 CLI exit 0；不拼接旧 PASS。
