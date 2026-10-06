# e0e9cbc CI 后续故障整改与复验报告

## 任务概况

2026-10-06 检查 e0e9cbc 的 GitHub Actions。确认两条失败运行、两个根因；F02 artifact 缺失及下载失败是提前停止的连带结果。原源码/工作流修复已通过，新依赖公告导致首轮完整评估失败；补充依赖升级后待新源码完整复验；不记作最新 hosted CI 通过。

## 修复明细

| 工作流 | 原因 | 修复与聚焦验证 |
|---|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/37394888372) | checkout 未初始化 Vibe 固定 gitlink；子目录 git rev-parse 回退父仓 e0e9cbc，与 c33133f 不符 | 主检出设置 submodules=true，固定 pin 不变；在无凭据的真实干净检出重现拒绝，再实际克隆公开固定提交，同一 F0 Gate READY；未执行上游程序 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37394888432) | RLS checker 抹去 DO 块，漏掉 A2 十表的 FOREACH/format ENABLE/FORCE/policy | 仅展开无条件 literal array 与确定 format DDL；条件/未知 RLS 块拒绝；50 表静态预检、5 项正负控制及 43 项回执测试 PASS；新增迁移 preflight 为完整 F0/A1 第 87 项 |

## 证据与风险边界

[初始结果](evidence/ci-e0e9cbc-remediation-20261006/initial-findings.json)保存失败日志、真实子模块拒绝/恢复及测试原件。静态 SQL 检查不等于 Supabase 执行结果。迁移 SQL、数据库权限、业务服务代码、API 与子模块 pin 未改变，仍保留最新已有目标证据及历史失败。

[前轮 G0 原件](evidence/frontend-g0-fep0-remediation-20261006-before-ci-e0e9cbc/g0.json)在覆盖固定当前路径前独立归档；历史用户答复、不可变文稿和范围仍保留。新范围须待项目用户确认，不自动批准。

## 完成与后续

首轮冻结 `2faef8e` 完整 87 项执行结束：86 PASS / 1 FAIL（source-map-js 1.2.1 高危公告），门禁未发布 READY。官方修复版 1.2.2 精确 override 与三个锁文件引用已更新，隔离和实际安装的 7 项有界防护/正常兼容探针通过，初次探针夹具失败原件保留。新源码冻结后将重新完整复验。最新代码未推送，新 hosted CI 尚未运行。最终结果以随后实际记录的 manifest、命令日志及当前 stage_gate 为准。
