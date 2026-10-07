# 47cb743 CI 整改与当前工程复评

## 一、任务完成概况

已修复 F02/F05 的 Supabase Storage fixture 缺少 file_size_limit 的共同问题，两个数据库 Gate 使用同一份完整桶定义。原 hosted CI 8 PASS/1 FAIL 原件见[验收报告](CI-47cb743-acceptance-2026-10-07.md)，新候选 hosted CI 尚未运行。

## 二、完成情况明细统计

共享 fixture 与 F02 强制兼容回归已实现；聚焦 F02 负向/恢复 23 PASS、1 数据库用例按默认配置跳过。单独连接配置的 Supabase，在事务临时表实际执行 5/5 PASS：旧缺列拒绝、全部桶迁移编译、重复 upsert、私有性及16MiB限制。初次 TLS 证书链失败保留，后续使用既有 CA 严格验证通过。

规范脚本变化使原26个内容回执失效，均已撤销；完整F0/A1与后续门禁正在重新评估，未将旧摘要直接迁移。

## 三、问题清单及风险分析

代码层根因已修复；verify-download 保留既有 fail-closed 行为，等待新候选 hosted CI 执行完整迁移、构建、签名与下载验收。F02/F05的GitHub runner fixture未在本机创建数据库复现，不将Supabase事务测试记作CI隔离重建通过。旧G0用户确认保留，新功能范围尚未确认。

## 四、整改建议与后续

完成当前功能工程复评并发布内容回执后提交源码及证据；推送新完整SHA后再验收hosted CI。记录[聚焦验证](evidence/ci-47cb743-remediation-20261007/focused-verification.json)；原回执/计划/确认快照保存在同目录before。
