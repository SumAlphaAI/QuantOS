# 4e9616ac CI 跟踪与修复（2026-10-28）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪基线 `4e9616ace3e97c573c4e133a59733959008472c8`，在 main 完成本地修复与提交，不推送。本地结果绑定基线及工作树字节，新提交 hosted CI、目标数据库、部署与发布验收仍为 NOT_RUN。

## 远端终态

该 SHA 的8个 push 工作流结束：7成功，唯独[主 CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40520921510)失败。Frontend Baseline、F01、F03、F08、F09、R01、Compatibility 成功；上轮迁移静态检查、PROVIDER:ALL 及 reference 启动修复已经继续通过。另有同 SHA 的 F08 Nightly、F09 Scheduled、R01 Scheduled 成功，总计11项中10成功、1失败。F09 的 local-observability 成功，release-candidate / supabase-target 跳过；不把 workflow SUCCESS 解释为目标执行通过。F05/F07 无运行。

主 CI 唯一前置失败为 Run SCA checks：pip-audit 报告 msgpack 1.2.2 命中 GHSA-j586-36cw-2gc2 / CVE-2026-114613；npm、Rust、Desktop Rust 扫描通过。verify-download 正常传播上游未完成，保留该行为。原日志及从日志去除时间前缀后提取的 SCA JSON 分别保留。

## 修复

[上游安全公告](https://github.com/msgpack/msgpack-python/security/advisories/GHSA-j586-36cw-2gc2) 和 [1.2.3 发布记录](https://github.com/msgpack/msgpack-python/releases/tag/v1.2.3) 将1.2.3标为修复版；缺陷涉及 C extension 在 strict_map_key 拒绝路径的引用释放及 streaming parser 状态。

依赖路径为 security group 的 pip-audit → CacheControl → msgpack，工程 Python 业务代码无 msgpack 直接引用。engines/pyproject.toml 增加 uv constraint-dependencies 下限 msgpack>=1.2.3；通过 uv 0.7.0 原生命令 `uv lock --project engines --upgrade-package msgpack==1.2.3` 更新锁文件的版本、sdist、各平台 wheel/hash。没有新增 runtime 依赖。

锁文件52项中仅 msgpack 1.2.2→1.2.3，其余51份 package 对象及 workspace members 完整不变。安装时重建8个原工作区 editable 包，包源码和版本未改。security/sca-waivers.json 仍为空；扫描脚本、门槛、Rust/Desktop 锁和既有 backport 验证均未修改。

## 验证

| 检查 | 结果 |
|---|---|
| 原 `QUANTOS_SKIP_ENV=1 make sca-check` | PASS；npm / pypi / cargo / cargo-desktop 均 PASS，未处理漏洞0项 |
| 既有 glib/braces backport 回归 | 原入口执行9项 PASS；既有 backport 验证保留 |
| uv lock --check / uv pip check | PASS；52项解析；已安装依赖兼容 |
| 锁文件图与来源逐项比较 | PASS；只升级 msgpack，registry/wheel/hash 由 uv 生成，无其他包改版 |
| CPython 3.12.10 C extension 引用释放探针 | 原1.2.2 FAIL，unpackb / streaming unpack / streaming iteration 各64次拒绝后分别残留64个 marker 引用；1.2.3同样输入分别为0 |
| 默认 strict_map_key / 正常序列化 | 两版本均拒绝全部192次非法 key；1.2.3 正常混合类型 round-trip PASS，未以关闭默认校验换取通过 |
| 实际 CacheControl Serializer 消费者 | 本地构造请求/响应的缓存序列化与读取 PASS；无 HTTP 请求 |
| F05/F07 手工策略 | 6 PASS、0 skip；未连接数据库 |
| git diff --check / 既有完整历史凭据扫描 | PASS，扫描配置和豁免未改 |

引用探针使用16字节自有 payload，每条路径64次，仅核对当前 macOS/CPython/C extension 的拒绝清理与直接缓存消费者。没有运行全平台/完整内存安全验收或 Unpacker.skip() 全面矩阵；补丁来源与版本依据为上游1.2.3。原失败及升级后的结果独立保存。

首次 uv 一致性检查受沙箱用户缓存权限限制，允许访问原缓存后复验通过；不将工具拒绝记为包不兼容或通过。锁图核对使用工程 Python3.12，而非不带 tomllib 的系统 Python。Desktop 原6项 unmaintained notices 保持既定 warning 范围，不改写为漏洞修复或隐藏。

## 证据与后续

[证据目录](evidence/ci-4e9616ac-20261028) 保存完整原失败日志、原/新 SCA JSON和四生态原始输出、锁图比较、安装记录、只读行为探针及前后结果、Scheduled终态和源码绑定。`.gz` 可 gzip -dc 无损读取，SHA256SUMS 绑定归档字节；source-binding 绑定两份依赖修复及本文，并记录未修改的门禁输入。

F05/F07 仍只允许 workflow_dispatch、显式确认且要求 QUANTOS_MANUAL_F05_F07=1。本轮未运行数据库 campaign、读取或复制数据库凭据、启动本机数据库、修改 secrets、推送或部署。没有因安全工具传递依赖升级重跑无关业务全仓/依赖链；后续 CI 尚未抵达的步骤、目标环境及发布验收保留 NOT_RUN。下一步由用户推送本地修复提交后，跟踪新同 SHA 的完整 SCA 及后续 CI。
